"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  Eye,
  FileStack,
  GripVertical,
  Loader2,
  RotateCw,
  Save,
  Search,
  Trash2,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { WorkspaceSubpageHero } from "../workspace-subpage-hero";
import { CASE_WORKFLOW_STEPS } from "../workspace-flow-ui";
import {
  buildWorkshopPdf,
  clearWorkshopDraft,
  downloadPdfBytes,
  expandSourceToPages,
  fetchSourceBytes,
  fetchWorkshopSources,
  loadWorkshopDraft,
  pdfBytesToObjectUrl,
  renderWorkshopPageThumbnail,
  rotatePage,
  saveWorkshopDraft,
  saveWorkshopPdf,
  workshopAuthHeaders,
  workshopSourceKey,
  type WorkshopPage,
  type WorkshopSourceDoc,
} from "@/lib/document-workshop";

const STEPS = [
  { id: 1, label: "Create" },
  { id: 2, label: "Add documents" },
  { id: 3, label: "Arrange" },
  { id: 4, label: "Preview" },
  { id: 5, label: "Settings" },
  { id: 6, label: "Done" },
] as const;

function formatBytes(n: number | null | undefined): string {
  if (!n || n <= 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function SortableThumb({
  page,
  index,
  onRotate,
  onRemove,
}: {
  page: WorkshopPage;
  index: number;
  onRotate: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: page.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm",
        isDragging && "z-10 opacity-90 ring-2 ring-primary",
      )}
    >
      <div className="flex items-center justify-between gap-1 border-b bg-muted/40 px-2 py-1.5">
        <button
          type="button"
          className="inline-flex cursor-grab touch-none items-center text-muted-foreground active:cursor-grabbing"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
        >
          <GripVertical className="size-4" />
        </button>
        <span className="text-[11px] font-semibold text-muted-foreground">Page {index + 1}</span>
        <div className="flex items-center gap-0.5">
          <Button type="button" variant="ghost" size="icon" className="size-7" onClick={onRotate} title="Rotate 90°">
            <RotateCw className="size-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="size-7 text-destructive" onClick={onRemove} title="Remove">
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
      <div className="flex aspect-[3/4] items-center justify-center bg-muted/20 p-2">
        {page.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={page.thumbnailUrl} alt="" className="max-h-full max-w-full object-contain shadow-sm" />
        ) : (
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        )}
      </div>
      <p className="truncate border-t px-2 py-1.5 text-[10px] text-muted-foreground" title={page.sourceLabel}>
        {page.sourceLabel}
        {page.kind === "pdf" ? ` · p${page.sourcePageIndex + 1}` : ""}
      </p>
    </div>
  );
}

export function DocumentWorkshopClient({ profileId }: { profileId: string }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("Document package");
  const [description, setDescription] = useState("");
  const [clientName, setClientName] = useState<string | null>(null);
  const [sources, setSources] = useState<WorkshopSourceDoc[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pages, setPages] = useState<WorkshopPage[]>([]);
  const [pageNumbers, setPageNumbers] = useState(false);
  const [search, setSearch] = useState("");
  const [loadingSources, setLoadingSources] = useState(true);
  const [expanding, setExpanding] = useState(false);
  const [building, setBuilding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [savedLabel, setSavedLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bytesCache = useRef<Map<string, Uint8Array>>(new Map());
  const draftRestored = useRef(false);
  const pagesRef = useRef<WorkshopPage[]>([]);
  pagesRef.current = pages;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const caseHubHref = `/dashboard/clients/${profileId}/workspace/case-management`;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingSources(true);
      setError(null);
      try {
        const data = await fetchWorkshopSources(profileId);
        if (cancelled) return;
        setClientName(data.client.name);
        setSources(data.documents);
        if (!draftRestored.current) {
          draftRestored.current = true;
          const draft = loadWorkshopDraft(profileId);
          if (draft) {
            setStep(Math.min(Math.max(draft.step, 1), 6));
            setName(draft.name || "Document package");
            setDescription(draft.description || "");
            setSelectedIds(new Set(draft.selectedSourceIds));
            setPageNumbers(Boolean(draft.pageNumbers));
            if (draft.name) {
              /* keep */
            }
          } else if (data.client.name) {
            setName(`${data.client.name} — document package`);
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load sources");
      } finally {
        if (!cancelled) setLoadingSources(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  useEffect(() => {
    saveWorkshopDraft(profileId, {
      step,
      name,
      description,
      selectedSourceIds: Array.from(selectedIds),
      pages: pages.map((p) => ({
        id: p.id,
        sourceKey: p.sourceKey,
        sourceId: p.sourceId,
        sourceKind: p.sourceKind,
        sourceLabel: p.sourceLabel,
        sourcePageIndex: p.sourcePageIndex,
        rotation: p.rotation,
        kind: p.kind,
      })),
      pageNumbers,
      updatedAt: new Date().toISOString(),
    });
  }, [profileId, step, name, description, selectedIds, pages, pageNumbers]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const filteredSources = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sources;
    return sources.filter(
      (s) =>
        s.document_label.toLowerCase().includes(q) ||
        s.original_filename.toLowerCase().includes(q) ||
        s.document_type.toLowerCase().includes(q),
    );
  }, [sources, search]);

  const toggleSource = (key: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const ensureBytes = useCallback(
    async (source: WorkshopSourceDoc) => {
      const key = workshopSourceKey(source);
      const cached = bytesCache.current.get(key);
      if (cached) return cached;
      const bytes = await fetchSourceBytes(source.stream_url, workshopAuthHeaders);
      bytesCache.current.set(key, bytes);
      return bytes;
    },
    [],
  );

  const expandSelected = useCallback(async () => {
    setExpanding(true);
    setError(null);
    try {
      const chosen = sources.filter((s) => selectedIds.has(workshopSourceKey(s)));
      if (chosen.length === 0) {
        setPages([]);
        return;
      }

      const currentPages = pagesRef.current;
      const existingBySource = new Map<string, WorkshopPage[]>();
      for (const p of currentPages) {
        const list = existingBySource.get(p.sourceKey) ?? [];
        list.push(p);
        existingBySource.set(p.sourceKey, list);
      }

      const draft = currentPages.length === 0 ? loadWorkshopDraft(profileId) : null;
      const draftPages = draft?.pages ?? [];
      const nextPages: WorkshopPage[] = [];

      for (const source of chosen) {
        const bytes = await ensureBytes(source);
        const expanded = await expandSourceToPages(source, bytes);
        const sourceKey = workshopSourceKey(source);
        const existing = existingBySource.get(sourceKey);
        if (existing && existing.length > 0) {
          for (const prev of existing) {
            const match = expanded.find((p) => p.sourcePageIndex === prev.sourcePageIndex);
            if (!match) continue;
            nextPages.push({
              ...match,
              id: prev.id,
              rotation: prev.rotation,
              thumbnailUrl: prev.rotation === match.rotation ? prev.thumbnailUrl : undefined,
            });
          }
          continue;
        }

        const metaForSource = draftPages.filter((p) => (p.sourceKey ?? `case_document:${p.sourceId}`) === sourceKey);
        if (metaForSource.length > 0) {
          for (const meta of metaForSource) {
            const match = expanded.find((p) => p.sourcePageIndex === meta.sourcePageIndex) ?? expanded[0];
            if (!match) continue;
            nextPages.push({
              ...match,
              id: meta.id,
              rotation: meta.rotation,
            });
          }
        } else {
          nextPages.push(...expanded);
        }
      }

      if (currentPages.length > 0) {
        const byId = new Map(nextPages.map((p) => [p.id, p]));
        const ordered: WorkshopPage[] = [];
        for (const p of currentPages) {
          const next = byId.get(p.id);
          if (next) {
            ordered.push(next);
            byId.delete(p.id);
          }
        }
        for (const p of byId.values()) ordered.push(p);
        setPages(ordered);
      } else if (draftPages.length > 0) {
        const byId = new Map(nextPages.map((p) => [p.id, p]));
        const ordered: WorkshopPage[] = [];
        for (const meta of draftPages) {
          const p = byId.get(meta.id);
          if (p) {
            ordered.push(p);
            byId.delete(meta.id);
          }
        }
        for (const p of byId.values()) ordered.push(p);
        setPages(ordered);
      } else {
        setPages(nextPages);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to expand documents");
      toast.error("Could not load document pages");
    } finally {
      setExpanding(false);
    }
  }, [sources, selectedIds, ensureBytes, profileId]);

  useEffect(() => {
    if (step >= 3 && selectedIds.size > 0 && pages.length === 0 && !expanding && !loadingSources) {
      void expandSelected();
    }
  }, [step, selectedIds, pages.length, expanding, expandSelected, loadingSources]);

  const thumbKey = pages.map((p) => `${p.id}:${p.rotation}:${p.thumbnailUrl ? "1" : "0"}`).join("|");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const needThumb = pages.filter((p) => !p.thumbnailUrl);
      if (needThumb.length === 0) return;
      const updates: Record<string, string | null> = {};
      for (const page of needThumb) {
        updates[page.id] = await renderWorkshopPageThumbnail(page);
        if (cancelled) return;
      }
      setPages((prev) =>
        prev.map((p) => (updates[p.id] !== undefined ? { ...p, thumbnailUrl: updates[p.id] } : p)),
      );
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- thumbKey encodes page ids/rotations needing thumbs
  }, [thumbKey]);

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setPages((items) => {
      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return items;
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  const buildPreview = async () => {
    if (pages.length === 0) {
      toast.error("Add at least one page");
      return;
    }
    setBuilding(true);
    setError(null);
    try {
      const bytes = await buildWorkshopPdf({ pages, pageNumbers });
      setPdfBytes(bytes);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(pdfBytesToObjectUrl(bytes));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to build PDF");
      toast.error("PDF build failed");
    } finally {
      setBuilding(false);
    }
  };

  const goNext = async () => {
    if (step === 1) {
      if (!name.trim()) {
        toast.error("Enter a name for this package");
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      if (selectedIds.size === 0) {
        toast.error("Select at least one document");
        return;
      }
      await expandSelected();
      setStep(3);
      return;
    }
    if (step === 3) {
      if (pages.length === 0) {
        toast.error("Arrange at least one page");
        return;
      }
      setStep(4);
      await buildPreview();
      return;
    }
    if (step === 4) {
      if (!pdfBytes) await buildPreview();
      setStep(5);
      return;
    }
    if (step === 5) {
      setBuilding(true);
      try {
        const bytes = await buildWorkshopPdf({ pages, pageNumbers });
        setPdfBytes(bytes);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(pdfBytesToObjectUrl(bytes));
        setStep(6);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Build failed");
      } finally {
        setBuilding(false);
      }
    }
  };

  const handleDownload = () => {
    if (!pdfBytes) {
      toast.error("PDF not ready yet");
      return;
    }
    downloadPdfBytes(pdfBytes, name.trim() || "document-package");
  };

  const handleSaveToCase = async () => {
    if (!pdfBytes) {
      toast.error("PDF not ready yet");
      return;
    }
    setSaving(true);
    try {
      const blob = new Blob([pdfBytes.slice().buffer], { type: "application/pdf" });
      const doc = await saveWorkshopPdf(profileId, blob, name.trim() || "Document package", description);
      setSavedLabel(doc.document_label);
      clearWorkshopDraft(profileId);
      toast.success("Saved to case documents");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <WorkspaceSubpageHero
        profileId={profileId}
        stepLabel="Case tools"
        title="Document Workshop"
        description="Select case uploads, arrange pages, and export one PDF for download or save to the case."
        illustration={CASE_WORKFLOW_STEPS[3].illustration}
        illustrationAlt="Document workshop"
        backHref={caseHubHref}
        backLabel="Back to Case Hub"
      />

      <nav className="flex flex-wrap gap-1 rounded-xl border bg-muted/30 p-1.5">
        {STEPS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              if (s.id < step) setStep(s.id);
            }}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors sm:text-sm",
              step === s.id
                ? "bg-background text-foreground shadow-sm"
                : step > s.id
                  ? "text-foreground/80 hover:bg-background/60"
                  : "cursor-default text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "flex size-5 items-center justify-center rounded-full text-[10px] font-bold",
                step > s.id ? "bg-primary text-primary-foreground" : step === s.id ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
              )}
            >
              {step > s.id ? <Check className="size-3" /> : s.id}
            </span>
            <span className="hidden sm:inline">{s.label}</span>
          </button>
        ))}
      </nav>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        {step === 1 && (
          <div className="mx-auto max-w-lg space-y-5">
            <div>
              <h2 className="text-lg font-semibold">Create package</h2>
              <p className="text-sm text-muted-foreground">Name this workshop output. Client is taken from the workspace.</p>
            </div>
            <div className="space-y-2">
              <Label>Client</Label>
              <Input value={clientName ?? "Loading…"} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ws-name">Package name</Label>
              <Input id="ws-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Express Entry supporting docs" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ws-desc">Description (optional)</Label>
              <Input id="ws-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Notes for your records" />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Add documents</h2>
                <p className="text-sm text-muted-foreground">
                  Choose PDF or image uploads from this client&apos;s cases ({selectedIds.size} selected).
                </p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-8" placeholder="Search documents…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>

            {loadingSources ? (
              <div className="flex justify-center py-16">
                <Loader2 className="size-7 animate-spin text-muted-foreground" />
              </div>
            ) : filteredSources.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-16 text-center">
                <FileStack className="size-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No PDF or image documents uploaded for this client yet.</p>
                <p className="text-xs text-muted-foreground">
                  Case checklist uploads and submitted package PDFs from the client portal appear here.
                </p>
                <Button variant="outline" asChild>
                  <Link href={caseHubHref}>Open Case Hub documents</Link>
                </Button>
              </div>
            ) : (
              <ul className="divide-y rounded-xl border">
                {filteredSources.map((doc) => {
                  const key = workshopSourceKey(doc);
                  const checked = selectedIds.has(key);
                  return (
                    <li key={key}>
                      <label className="flex cursor-pointer items-start gap-3 px-3 py-3 hover:bg-muted/40 sm:items-center">
                        <Checkbox checked={checked} onCheckedChange={() => toggleSource(key)} className="mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{doc.document_label || doc.original_filename}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {doc.original_filename} · {doc.is_pdf ? "PDF" : "Image"}
                            {doc.source_kind === "package_submission" ? " · Package form" : ""} · {formatBytes(doc.file_size)}
                          </p>
                        </div>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Arrange pages</h2>
                <p className="text-sm text-muted-foreground">Drag to reorder, rotate, or remove pages.</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setStep(2)} disabled={expanding}>
                Add more documents
              </Button>
            </div>
            {expanding ? (
              <div className="flex flex-col items-center gap-2 py-16">
                <Loader2 className="size-7 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Expanding documents into pages…</p>
              </div>
            ) : pages.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No pages yet. Go back and select documents.</p>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={pages.map((p) => p.id)} strategy={rectSortingStrategy}>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {pages.map((page, index) => (
                      <SortableThumb
                        key={page.id}
                        page={page}
                        index={index}
                        onRotate={() =>
                          setPages((prev) => prev.map((p) => (p.id === page.id ? rotatePage(p, 90) : p)))
                        }
                        onRemove={() => setPages((prev) => prev.filter((p) => p.id !== page.id))}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Preview</h2>
                <p className="text-sm text-muted-foreground">Review the merged PDF before final settings.</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => void buildPreview()} disabled={building}>
                {building ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Eye className="mr-2 size-4" />}
                Rebuild preview
              </Button>
            </div>
            {building && !previewUrl ? (
              <div className="flex justify-center py-20">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
              </div>
            ) : previewUrl ? (
              <iframe title="Workshop PDF preview" src={previewUrl} className="h-[70vh] w-full rounded-xl border bg-muted/20" />
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">Preview not ready.</p>
            )}
          </div>
        )}

        {step === 5 && (
          <div className="mx-auto max-w-lg space-y-5">
            <div>
              <h2 className="text-lg font-semibold">Settings</h2>
              <p className="text-sm text-muted-foreground">Output format is fixed to PDF · A4 portrait for v1.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ws-name-2">File name</Label>
              <Input id="ws-name-2" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="rounded-xl border bg-muted/20 px-4 py-3 text-sm">
              <p>
                <span className="font-medium">Format:</span> PDF
              </p>
              <p className="mt-1">
                <span className="font-medium">Page size:</span> A4 portrait
              </p>
              <p className="mt-1">
                <span className="font-medium">Pages:</span> {pages.length}
              </p>
            </div>
            <div className="flex items-center justify-between rounded-xl border px-4 py-3">
              <div>
                <p className="text-sm font-medium">Page numbers</p>
                <p className="text-xs text-muted-foreground">Show “n / total” at the bottom of each page</p>
              </div>
              <Switch checked={pageNumbers} onCheckedChange={setPageNumbers} />
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="mx-auto max-w-lg space-y-5 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Check className="size-7" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Package ready</h2>
              <p className="text-sm text-muted-foreground">
                {name.trim() || "Document package"} · {pages.length} page{pages.length === 1 ? "" : "s"}
              </p>
              {savedLabel && <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-400">Saved as “{savedLabel}”</p>}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button type="button" onClick={handleDownload} disabled={!pdfBytes}>
                <Download className="mr-2 size-4" />
                Download PDF
              </Button>
              {previewUrl && (
                <Button type="button" variant="outline" asChild>
                  <a href={previewUrl} target="_blank" rel="noreferrer">
                    <Eye className="mr-2 size-4" />
                    View
                  </a>
                </Button>
              )}
              <Button type="button" variant="secondary" onClick={() => void handleSaveToCase()} disabled={saving || !pdfBytes}>
                {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
                Save to Case
              </Button>
            </div>
            <Button type="button" variant="ghost" asChild>
              <Link href={caseHubHref}>
                <ArrowLeft className="mr-2 size-4" />
                Return to Case Hub
              </Link>
            </Button>
          </div>
        )}
      </div>

      {step < 6 && (
        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1 || expanding || building}
          >
            <ArrowLeft className="mr-2 size-4" />
            Back
          </Button>
          <Button type="button" onClick={() => void goNext()} disabled={expanding || building || loadingSources}>
            {expanding || building ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            {step === 5 ? "Finish" : "Continue"}
            {step < 5 ? <ArrowRight className="ml-2 size-4" /> : <Check className="ml-2 size-4" />}
          </Button>
        </div>
      )}
    </div>
  );
}
