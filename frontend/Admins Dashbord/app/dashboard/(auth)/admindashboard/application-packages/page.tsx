"use client";

import * as React from "react";
import {
  FolderOpen,
  Upload,
  Trash2,
  Pencil,
  PlusCircle,
  RefreshCw,
  FileText,
  CloudDownload,
  ExternalLink,
  Eye,
  FormInput,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import { adminAuthHeaders } from "@/lib/admin-auth";
import { Progress } from "@/components/ui/progress";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

type PackageDocument = {
  id: number;
  label: string;
  doc_type: string;
  original_filename: string;
  file_url: string;
  mime_type: string | null;
  file_size: number | null;
};

type ApplicationPackage = {
  id: number;
  level: number;
  label: string;
  breadcrumb: string[];
  result: { guide: string; checklist: string; forms: string[] } | null;
  documents: PackageDocument[];
  is_online_only?: boolean;
  interactive_form_count?: number;
};

type OnlineOnlyPackage = {
  id: number;
  label: string;
  breadcrumb: string[];
  interactive_form_count: number;
};

type InteractiveFormSyncStats = {
  packages: number;
  created: number;
  updated: number;
  unchanged: number;
  total_forms: number;
  package_results?: Array<{
    package_label: string;
    created: number;
    updated: number;
    unchanged: number;
    forms?: Array<{ slug: string; title: string; action: string }>;
  }>;
};

type SyncStatus = {
  catalog_count: number;
  catalog_with_pdf: number;
  auto_documents: number;
  last_catalog_fetch: string | null;
  source_url: string;
  online_only_package_count?: number;
  interactive_form_count?: number;
  online_only_packages?: OnlineOnlyPackage[];
};

type SyncProgress = {
  percent: number;
  label: string;
  active: boolean;
};

type FormSchemaField = {
  type: string;
  key?: string;
  label: string;
  required?: boolean;
  help_text?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
};

type InteractiveForm = {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  form_schema: { fields: FormSchemaField[] };
  sort_order: number;
  is_active: boolean;
};

function inputFieldCount(form: InteractiveForm): number {
  return (form.form_schema?.fields ?? []).filter((f) => f.type !== "section").length;
}

function fieldTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    text: "Text",
    textarea: "Long text",
    email: "Email",
    tel: "Phone",
    number: "Number",
    date: "Date",
    select: "Dropdown",
    checkbox: "Checkbox",
    radio: "Choice",
    file: "File upload",
    section: "Section",
  };
  return labels[type] ?? type;
}

export default function ApplicationPackagesPage() {
  const [packages, setPackages] = React.useState<ApplicationPackage[]>([]);
  const [syncStatus, setSyncStatus] = React.useState<SyncStatus | null>(null);
  const [syncing, setSyncing] = React.useState<"catalog" | "all" | "one" | null>(null);
  const [syncProgress, setSyncProgress] = React.useState<SyncProgress>({
    percent: 0,
    label: "",
    active: false,
  });
  const [syncMessage, setSyncMessage] = React.useState("");
  const [interactiveSyncStats, setInteractiveSyncStats] = React.useState<InteractiveFormSyncStats | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [selected, setSelected] = React.useState<ApplicationPackage | null>(null);
  const [editOpen, setEditOpen] = React.useState(false);
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);

  const [form, setForm] = React.useState({
    guide: "",
    checklist: "",
    formsText: "",
  });

  const [uploadForm, setUploadForm] = React.useState({
    label: "",
    doc_type: "other",
    file: null as File | null,
  });

  const [interactiveForms, setInteractiveForms] = React.useState<InteractiveForm[]>([]);
  const [formsLoading, setFormsLoading] = React.useState(false);
  const [viewFormOpen, setViewFormOpen] = React.useState(false);
  const [viewingForm, setViewingForm] = React.useState<InteractiveForm | null>(null);

  async function loadInteractiveForms(packageId: number) {
    setFormsLoading(true);
    try {
      const res = await fetch(`${API}/admin/application-packages/${packageId}/interactive-forms`, {
        headers: adminAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok) setInteractiveForms(data.data ?? []);
      else setInteractiveForms([]);
    } catch {
      setInteractiveForms([]);
    } finally {
      setFormsLoading(false);
    }
  }

  React.useEffect(() => {
    if (!selected) {
      setInteractiveForms([]);
      return;
    }
    if (selected.is_online_only || (selected.interactive_form_count ?? 0) > 0) {
      loadInteractiveForms(selected.id);
    } else {
      setInteractiveForms([]);
    }
  }, [selected?.id, selected?.is_online_only, selected?.interactive_form_count]);

  function openFormPreview(form: InteractiveForm) {
    setViewingForm(form);
    setViewFormOpen(true);
  }

  async function loadSyncStatus() {
    try {
      const res = await fetch(`${API}/admin/application-packages/sync-status`, {
        headers: adminAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok) setSyncStatus(data);
    } catch {
      // ignore
    }
  }

  async function loadPackages(): Promise<ApplicationPackage[]> {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/admin/application-packages/leaves`, {
        headers: adminAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? "Failed to load packages.");
      const list = data.data ?? [];
      setPackages(list);
      return list;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load packages.");
      return [];
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    loadPackages();
    loadSyncStatus();
  }, []);

  function updateProgress(percent: number, label: string) {
    setSyncProgress({ percent: Math.min(100, Math.max(0, percent)), label, active: true });
  }

  async function syncFromCanada(mode: "catalog" | "all") {
    setSyncing(mode);
    setSyncMessage("");
    setInteractiveSyncStats(null);
    setError("");
    updateProgress(0, mode === "all" ? "Starting full sync…" : "Starting catalog sync…");

    try {
      if (mode === "catalog") {
        updateProgress(15, "Fetching form catalog from Canada.ca…");
        const res = await fetch(`${API}/admin/application-packages/sync-catalog`, {
          method: "POST",
          headers: adminAuthHeaders("application/json"),
          body: JSON.stringify({ pdf_limit: 80 }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message ?? "Sync failed.");
        updateProgress(100, `Catalog updated — ${data.stats?.total ?? 0} forms indexed`);
        setSyncMessage(data.message ?? "Catalog sync completed.");
      } else {
        updateProgress(5, "Step 1/3: Fetching IRCC form catalog from Canada.ca…");
        const catRes = await fetch(`${API}/admin/application-packages/sync-catalog`, {
          method: "POST",
          headers: adminAuthHeaders("application/json"),
          body: JSON.stringify({ pdf_limit: 80 }),
        });
        const catData = await catRes.json();
        if (!catRes.ok) throw new Error(catData?.message ?? "Catalog sync failed.");

        updateProgress(
          20,
          `Step 1/3 complete — ${catData.stats?.total ?? 0} forms, ${catData.stats?.pdf_resolved ?? 0} PDFs resolved`
        );

        let pkgList = packages;
        if (pkgList.length === 0) {
          const leavesRes = await fetch(`${API}/admin/application-packages/leaves`, {
            headers: adminAuthHeaders(),
          });
          const leavesData = await leavesRes.json();
          if (!leavesRes.ok) throw new Error(leavesData?.message ?? "Failed to load packages.");
          pkgList = leavesData.data ?? [];
        }

        const pdfPackages = pkgList.filter((p) => !p.is_online_only);
        const total = pdfPackages.length;
        let downloaded = 0;
        let updated = 0;
        let skipped = 0;
        const errors: string[] = [];

        for (let i = 0; i < total; i++) {
          const pkg = pdfPackages[i];
          const pct = 20 + Math.round((50 * i) / Math.max(total, 1));
          updateProgress(
            pct,
            `Step 2/3: Syncing PDFs — package ${i + 1} of ${total} — ${pkg.label}`
          );

          try {
            const res = await fetch(`${API}/admin/application-packages/${pkg.id}/sync`, {
              method: "POST",
              headers: adminAuthHeaders(),
            });
            const data = await res.json();
            if (!res.ok) {
              errors.push(`${pkg.label}: ${data?.message ?? "failed"}`);
              continue;
            }
            downloaded += data.stats?.downloaded ?? 0;
            updated += data.stats?.updated ?? 0;
            skipped += data.stats?.skipped ?? 0;
          } catch (e) {
            errors.push(`${pkg.label}: ${e instanceof Error ? e.message : "failed"}`);
          }
        }

        updateProgress(72, "Step 3/3: Updating online-only HTML forms…");
        const formsRes = await fetch(`${API}/admin/application-packages/sync-interactive-forms`, {
          method: "POST",
          headers: adminAuthHeaders(),
        });
        const formsData = await formsRes.json();
        if (!formsRes.ok) throw new Error(formsData?.message ?? "Interactive forms sync failed.");

        const iStats = formsData.stats as InteractiveFormSyncStats;
        setInteractiveSyncStats(iStats);

        updateProgress(
          100,
          `Complete — PDFs: ${downloaded} new, ${updated} updated · HTML forms: ${iStats.created} created, ${iStats.updated} updated`
        );
        setSyncMessage(
          `Full sync completed. PDF documents: ${downloaded} downloaded, ${updated} updated, ${skipped} unchanged. ` +
          `Online-only packages (${iStats.packages}): ${iStats.created} HTML forms created, ${iStats.updated} updated, ${iStats.unchanged} unchanged.`
        );
        if (errors.length > 0) {
          setError(`${errors.length} PDF package(s) had issues. First: ${errors[0]}`);
        }
      }

      const refreshedList = await loadPackages();
      await loadSyncStatus();
      if (selected) {
        const refreshed = refreshedList.find((p) => p.id === selected.id);
        if (refreshed) {
          setSelected(refreshed);
          if (refreshed.is_online_only) {
            await loadInteractiveForms(refreshed.id);
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed.");
      updateProgress(0, "Sync failed");
    } finally {
      setSyncing(null);
      window.setTimeout(() => {
        setSyncProgress((prev) => ({ ...prev, active: false }));
      }, 4000);
    }
  }

  async function syncSelectedPackage() {
    if (!selected) return;
    setSyncing("one");
    setError("");
    setInteractiveSyncStats(null);
    const isOnline = selected.is_online_only;
    updateProgress(
      10,
      isOnline
        ? `Updating HTML forms for "${selected.label}"…`
        : `Syncing "${selected.label}" from Canada.ca…`
    );
    try {
      updateProgress(40, isOnline ? "Ensuring interactive form templates…" : "Downloading official PDFs…");
      const res = await fetch(`${API}/admin/application-packages/${selected.id}/sync`, {
        method: "POST",
        headers: adminAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? "Sync failed.");

      if (data.is_online_only && data.interactive_forms) {
        setInteractiveSyncStats({
          packages: 1,
          created: data.interactive_forms.created ?? 0,
          updated: data.interactive_forms.updated ?? 0,
          unchanged: data.interactive_forms.unchanged ?? 0,
          total_forms: data.interactive_forms.total ?? 0,
          package_results: [data.interactive_forms],
        });
        updateProgress(
          100,
          `HTML forms — ${data.interactive_forms.created ?? 0} created, ${data.interactive_forms.updated ?? 0} updated, ${data.interactive_forms.unchanged ?? 0} unchanged`
        );
      } else {
        updateProgress(
          100,
          `Done — ${data.stats?.downloaded ?? 0} new, ${data.stats?.updated ?? 0} updated`
        );
      }

      setSyncMessage(data.message ?? "Package synced.");
      const packageId = data.data?.id ?? selected.id;
      if (data.data) setSelected(data.data);
      await loadPackages();
      await loadSyncStatus();
      if (data.is_online_only) {
        await loadInteractiveForms(packageId);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed.");
    } finally {
      setSyncing(null);
      window.setTimeout(() => {
        setSyncProgress((prev) => ({ ...prev, active: false }));
      }, 3000);
    }
  }

  function openEdit(pkg: ApplicationPackage) {
    setSelected(pkg);
    setForm({
      guide: pkg.result?.guide ?? "",
      checklist: pkg.result?.checklist ?? "",
      formsText: (pkg.result?.forms ?? []).join("\n"),
    });
    setEditOpen(true);
  }

  async function savePackage() {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/admin/application-packages/${selected.id}`, {
        method: "PUT",
        headers: adminAuthHeaders("application/json"),
        body: JSON.stringify({
          guide: form.guide,
          checklist: form.checklist,
          forms: form.formsText
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? "Save failed.");
      setEditOpen(false);
      await loadPackages();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadDocument() {
    if (!selected || !uploadForm.file) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.append("label", uploadForm.label);
      body.append("doc_type", uploadForm.doc_type);
      body.append("file", uploadForm.file);

      const res = await fetch(`${API}/admin/application-packages/${selected.id}/documents`, {
        method: "POST",
        headers: adminAuthHeaders(),
        body,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? "Upload failed.");
      setUploadOpen(false);
      setUploadForm({ label: "", doc_type: "other", file: null });
      await loadPackages();
      if (selected) {
        const updated = (data.data ? { ...selected, documents: [...selected.documents, data.data] } : null);
        if (updated) setSelected(updated);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function deleteDocument(docId: number) {
    if (!selected) return;
    if (!confirm("Delete this document?")) return;
    try {
      const res = await fetch(
        `${API}/admin/application-packages/${selected.id}/documents/${docId}`,
        { method: "DELETE", headers: adminAuthHeaders() }
      );
      if (!res.ok) throw new Error("Delete failed.");
      await loadPackages();
      setSelected((prev) =>
        prev ? { ...prev, documents: prev.documents.filter((d) => d.id !== docId) } : prev
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed.");
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <FolderOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Application Package Manage</h1>
            <p className="text-sm text-muted-foreground">
              Manage IRCC application packages, guides, checklists, forms, and uploaded documents.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="default"
            onClick={() => syncFromCanada("all")}
            disabled={!!syncing}
          >
            <CloudDownload className={`mr-2 h-4 w-4 ${syncing === "all" ? "animate-pulse" : ""}`} />
            {syncing === "all" ? "Syncing…" : "Sync All from Canada.ca"}
          </Button>
          <Button variant="outline" onClick={loadPackages} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-blue-50/50 border-blue-200 p-4 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-blue-900">Auto-sync from IRCC (Canada.ca)</p>
            <p className="text-xs text-blue-800 mt-1 max-w-2xl">
              Official forms are fetched from{" "}
              <a
                href="https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides.html"
                target="_blank"
                rel="noreferrer"
                className="underline inline-flex items-center gap-1"
              >
                canada.ca IRCC forms page <ExternalLink className="h-3 w-3" />
              </a>
              . When IRCC updates a form, click sync to download the latest PDF into each application package.
              Clients receive updated files after the consultant assigns the package.
            </p>
          {syncStatus && (
            <p className="text-xs text-blue-700 mt-2">
              Catalog: {syncStatus.catalog_count} forms ({syncStatus.catalog_with_pdf} with PDF) ·
              Auto-synced PDFs: {syncStatus.auto_documents} ·
              Online-only packages: {syncStatus.online_only_package_count ?? 0} ·
              HTML forms: {syncStatus.interactive_form_count ?? 0} ·
              Last fetch: {syncStatus.last_catalog_fetch ? new Date(syncStatus.last_catalog_fetch).toLocaleString() : "Never"}
            </p>
          )}
          {syncMessage && (
            <p className="text-xs text-green-700 mt-2 font-medium">{syncMessage}</p>
          )}
          {interactiveSyncStats && interactiveSyncStats.packages > 0 && (
            <div className="mt-3 rounded-lg border border-purple-200 bg-purple-50/80 p-3 text-xs text-purple-900 space-y-2">
              <p className="font-semibold">
                Online-only HTML forms — {interactiveSyncStats.packages} package(s):{" "}
                {interactiveSyncStats.created} created, {interactiveSyncStats.updated} updated,{" "}
                {interactiveSyncStats.unchanged} unchanged
              </p>
              {interactiveSyncStats.package_results?.map((pkg) => (
                <div key={pkg.package_label}>
                  <p className="font-medium">{pkg.package_label}</p>
                  <ul className="ml-4 list-disc text-purple-800">
                    {pkg.forms?.map((f) => (
                      <li key={f.slug}>
                        {f.title} —{" "}
                        <span className={
                          f.action === "updated" ? "text-amber-700 font-medium"
                          : f.action === "created" ? "text-green-700 font-medium"
                          : "text-muted-foreground"
                        }>
                          {f.action}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
          </div>
          <Button variant="outline" size="sm" onClick={() => syncFromCanada("catalog")} disabled={!!syncing}>
            {syncing === "catalog" ? "Updating catalog…" : "Update catalog only"}
          </Button>
        </div>
        {syncProgress.active && (
          <div className="space-y-2 rounded-lg border border-blue-200 bg-white/70 p-3">
            <div className="flex items-center justify-between gap-3 text-xs font-medium text-blue-900">
              <span className="truncate">{syncProgress.label}</span>
              <span className="shrink-0 tabular-nums">{syncProgress.percent}%</span>
            </div>
            <Progress value={syncProgress.percent} className="h-2.5" />
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 rounded-xl border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="font-semibold">All Application Packages (Level 3)</h2>
          </div>
          {loading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Package Path</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Guide</TableHead>
                  <TableHead>Docs / Forms</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {packages.map((pkg) => (
                  <TableRow
                    key={pkg.id}
                    className={selected?.id === pkg.id ? "bg-muted/50" : ""}
                    onClick={() => setSelected(pkg)}
                  >
                    <TableCell>
                      <div className="text-xs text-muted-foreground">
                        {pkg.breadcrumb.slice(0, -1).join(" › ")}
                      </div>
                      <div className="font-medium">{pkg.label}</div>
                    </TableCell>
                    <TableCell>
                      {pkg.is_online_only ? (
                        <Badge variant="outline" className="border-purple-300 bg-purple-50 text-purple-800 text-[10px]">
                          Online-only
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">PDF sync</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{pkg.result?.guide ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="secondary">{pkg.documents.length} PDF</Badge>
                        {(pkg.interactive_form_count ?? 0) > 0 && (
                          <Badge variant="outline" className="border-purple-200 text-purple-800">
                            {pkg.interactive_form_count} HTML
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(pkg)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="lg:col-span-2 rounded-xl border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
            <h2 className="font-semibold">
              {selected?.is_online_only ? "Package Forms & Documents" : "Package Documents"}
            </h2>
            <div className="flex flex-wrap gap-2">
            {selected && (
              <Button size="sm" variant="secondary" onClick={syncSelectedPackage} disabled={!!syncing}>
                <CloudDownload className="mr-1 h-4 w-4" />
                {syncing === "one"
                  ? "Syncing…"
                  : selected.is_online_only
                    ? "Update HTML forms"
                    : "Sync from Canada.ca"}
              </Button>
            )}
            {selected && !selected.is_online_only && (
              <Button size="sm" onClick={() => setUploadOpen(true)}>
                <Upload className="mr-1 h-4 w-4" />
                Upload
              </Button>
            )}
            </div>
          </div>
          {!selected ? (
            <p className="p-6 text-sm text-muted-foreground">
              Select a package from the list to manage its uploaded documents.
            </p>
          ) : (
            <div className="space-y-3 p-4">
              <div>
                <p className="text-xs text-muted-foreground">Selected package</p>
                <p className="font-semibold">{selected.label}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {selected.breadcrumb.join(" › ")}
                </p>
                {selected.is_online_only && (
                  <div className="mt-2 rounded-md border border-purple-200 bg-purple-50/60 px-3 py-2 text-xs text-purple-900">
                    <p className="font-medium">Online-only application</p>
                    <p className="mt-1 text-purple-800">
                      No PDF on Canada.ca — uses {selected.interactive_form_count ?? 0} HTML form(s).
                      Sync updates form templates (not client answers).
                    </p>
                  </div>
                )}
              </div>
              {!selected.is_online_only && selected.documents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No PDF documents uploaded yet.</p>
              ) : !selected.is_online_only ? (
                selected.documents.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-2 rounded-lg border p-3">
                    <FileText className="h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{doc.label}</p>
                      <p className="truncate text-xs text-muted-foreground">{doc.original_filename}</p>
                      <Badge variant="outline" className="mt-1 text-[10px]">{doc.doc_type}</Badge>
                    </div>
                    <Button size="sm" variant="ghost" asChild>
                      <a href={doc.file_url} target="_blank" rel="noreferrer">View</a>
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteDocument(doc.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))
              ) : null}

              {selected.is_online_only && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-purple-900">HTML application forms</p>
                    <Badge variant="outline" className="border-purple-200 text-purple-800">
                      {interactiveForms.length} form(s)
                    </Badge>
                  </div>

                  {formsLoading ? (
                    <div className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading forms…
                    </div>
                  ) : interactiveForms.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-purple-200 bg-purple-50/40 p-4 text-sm text-purple-900">
                      <p>No HTML forms yet.</p>
                      <p className="mt-1 text-xs text-purple-800">
                        Click <strong>Update HTML forms</strong> above to create the default online-only form templates.
                      </p>
                    </div>
                  ) : (
                    interactiveForms.map((form) => (
                      <div
                        key={form.id}
                        className="flex items-start gap-2 rounded-lg border border-purple-200 bg-purple-50/30 p-3"
                      >
                        <FormInput className="mt-0.5 h-4 w-4 shrink-0 text-purple-700" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{form.title}</p>
                          {form.description && (
                            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{form.description}</p>
                          )}
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            <Badge variant="outline" className="text-[10px] border-purple-200">
                              {inputFieldCount(form)} fields
                            </Badge>
                            <Badge variant="secondary" className="text-[10px]">{form.slug}</Badge>
                            {!form.is_active && (
                              <Badge variant="destructive" className="text-[10px]">Inactive</Badge>
                            )}
                          </div>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => openFormPreview(form)}>
                          <Eye className="mr-1 h-3.5 w-3.5" />
                          View
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              )}
              <Button variant="outline" className="w-full" onClick={() => openEdit(selected)}>
                Edit guide / checklist / forms
              </Button>
            </div>
          )}
        </div>
      </div>

      <Dialog open={viewFormOpen} onOpenChange={setViewFormOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewingForm?.title ?? "Form preview"}</DialogTitle>
          </DialogHeader>
          {viewingForm && (
            <div className="space-y-4">
              {viewingForm.description && (
                <p className="text-sm text-muted-foreground">{viewingForm.description}</p>
              )}
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{viewingForm.slug}</Badge>
                <Badge variant="secondary">{inputFieldCount(viewingForm)} input fields</Badge>
              </div>
              <div className="rounded-lg border bg-muted/20 divide-y">
                {(viewingForm.form_schema?.fields ?? []).map((field, idx) =>
                  field.type === "section" ? (
                    <div key={`section-${idx}`} className="bg-muted/40 px-4 py-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {field.label}
                      </p>
                    </div>
                  ) : (
                    <div key={field.key ?? idx} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {field.label}
                          {field.required && <span className="text-destructive ml-0.5">*</span>}
                        </p>
                        {field.key && (
                          <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{field.key}</p>
                        )}
                        {field.help_text && (
                          <p className="text-xs text-muted-foreground mt-1">{field.help_text}</p>
                        )}
                        {field.options && field.options.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Options: {field.options.map((o) => o.label).join(", ")}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        {fieldTypeLabel(field.type)}
                      </Badge>
                    </div>
                  )
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                This is the admin template clients fill in their dashboard. Client answers are stored separately.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewFormOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Application Package</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Instruction Guide</Label>
              <Input value={form.guide} onChange={(e) => setForm({ ...form, guide: e.target.value })} />
            </div>
            <div>
              <Label>Document Checklist</Label>
              <Input value={form.checklist} onChange={(e) => setForm({ ...form, checklist: e.target.value })} />
            </div>
            <div>
              <Label>Required Forms (one per line)</Label>
              <Textarea
                rows={5}
                value={form.formsText}
                onChange={(e) => setForm({ ...form, formsText: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={savePackage} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Package Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Document label</Label>
              <Input
                placeholder="e.g. Instruction Guide PDF"
                value={uploadForm.label}
                onChange={(e) => setUploadForm({ ...uploadForm, label: e.target.value })}
              />
            </div>
            <div>
              <Label>Document type</Label>
              <Select
                value={uploadForm.doc_type}
                onValueChange={(v) => setUploadForm({ ...uploadForm, doc_type: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="guide">Guide</SelectItem>
                  <SelectItem value="checklist">Checklist</SelectItem>
                  <SelectItem value="form">Form</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>File (PDF, DOC, images — max 20MB)</Label>
              <Input
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                onChange={(e) => setUploadForm({ ...uploadForm, file: e.target.files?.[0] ?? null })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button>
            <Button
              onClick={uploadDocument}
              disabled={uploading || !uploadForm.label || !uploadForm.file}
            >
              {uploading ? "Uploading…" : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
