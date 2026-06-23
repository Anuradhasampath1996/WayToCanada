"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  AlertCircle,
  RefreshCw,
  Check,
  User,
  FileText,
  Clock,
  CheckCircle2,
  Send,
  ClipboardCheck,
  ArrowUpRight,
  GripVertical,
  Settings2,
  ChevronUp,
  ChevronDown,
  EyeOff,
  Plus,
  RotateCcw,
  Trash2,
  Briefcase,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  type PipelineBoardConfig,
  type PipelineBoardColumn,
  type PipelineStatusKey,
  DEFAULT_COLUMN_LABELS,
  loadBoardConfig,
  saveBoardConfig,
  visibleBoardColumns,
  availableStatusKeys,
  addCustomColumn,
  defaultBoardConfig,
} from "@/lib/pipeline-board-config";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

export interface PipelineEntry {
  profile_id: number;
  client_name: string;
  client_email: string;
  status: string;
  immigration_pathway: string | null;
  agreement_signed_at: string | null;
  pending_docs: number;
  case_file_id: number;
}

type StatusTheme = {
  shortLabel: string;
  icon: LucideIcon;
  accentBar: string;
  headerClass: string;
  iconClass: string;
  badgeClass: string;
  dropZoneClass: string;
};

const STATUS_THEMES: Record<PipelineStatusKey, StatusTheme> = {
  AGREEMENT_SIGNED: {
    shortLabel: "Retainer",
    icon: FileText,
    accentBar: "border-b-blue-200/60 bg-gradient-to-r from-blue-500/10 to-transparent",
    headerClass: "text-blue-800 dark:text-blue-300",
    iconClass: "bg-blue-500/20 text-blue-600 dark:text-blue-400",
    badgeClass: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-200/50",
    dropZoneClass: "border-blue-200/40 bg-blue-500/[0.03]",
  },
  DOCUMENTS_UPLOADING: {
    shortLabel: "Documents",
    icon: Clock,
    accentBar: "border-b-amber-200/60 bg-gradient-to-r from-amber-500/10 to-transparent",
    headerClass: "text-amber-800 dark:text-amber-300",
    iconClass: "bg-amber-500/20 text-amber-600 dark:text-amber-400",
    badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200/50",
    dropZoneClass: "border-amber-200/40 bg-amber-500/[0.03]",
  },
  UNDER_REVIEW: {
    shortLabel: "Review",
    icon: ClipboardCheck,
    accentBar: "border-b-violet-200/60 bg-gradient-to-r from-violet-500/10 to-transparent",
    headerClass: "text-violet-800 dark:text-violet-300",
    iconClass: "bg-violet-500/20 text-violet-600 dark:text-violet-400",
    badgeClass: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-200/50",
    dropZoneClass: "border-violet-200/40 bg-violet-500/[0.03]",
  },
  READY_FOR_SUBMISSION: {
    shortLabel: "Ready",
    icon: CheckCircle2,
    accentBar: "border-b-emerald-200/60 bg-gradient-to-r from-emerald-500/10 to-transparent",
    headerClass: "text-emerald-800 dark:text-emerald-300",
    iconClass: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
    badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200/50",
    dropZoneClass: "border-emerald-200/40 bg-emerald-500/[0.03]",
  },
  APPLICATION_SUBMITTED: {
    shortLabel: "Submitted",
    icon: Send,
    accentBar: "border-b-slate-200/60 bg-gradient-to-r from-slate-500/10 to-transparent",
    headerClass: "text-slate-800 dark:text-slate-200",
    iconClass: "bg-slate-500/20 text-slate-600 dark:text-slate-300",
    badgeClass: "bg-slate-500/15 text-slate-700 dark:text-slate-200 border-slate-200/50",
    dropZoneClass: "border-slate-200/40 bg-slate-500/[0.03]",
  },
};

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("wtc_consultant_token") : null;
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function fmtDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

function ClientCard({
  entry,
  onDragStart,
}: {
  entry: PipelineEntry;
  onDragStart: (e: React.DragEvent, entry: PipelineEntry) => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, entry)}
      className="group cursor-grab select-none rounded-xl border border-border/60 bg-background p-3 shadow-sm transition-all hover:border-primary/25 hover:shadow-md active:cursor-grabbing active:scale-[0.98]"
    >
      <div className="flex items-start gap-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
          {initials(entry.client_name) || <User className="size-3.5" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight">{entry.client_name}</p>
          <p className="truncate text-[11px] text-muted-foreground">{entry.client_email}</p>
        </div>
        <GripVertical className="size-3.5 shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground" />
      </div>
      {entry.immigration_pathway && (
        <Badge variant="outline" className="mt-2.5 h-5 px-1.5 text-[10px] font-medium">
          {entry.immigration_pathway}
        </Badge>
      )}
      <div className="mt-2.5 flex items-center justify-between gap-2">
        {entry.pending_docs > 0 ? (
          <span className="inline-flex items-center rounded-full border border-amber-200/80 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-300">
            {entry.pending_docs} pending
          </span>
        ) : (
          <span className="inline-flex items-center gap-0.5 rounded-full border border-emerald-200/80 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-800 dark:text-emerald-300">
            <Check className="size-2.5" />
            Reviewed
          </span>
        )}
        <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px] text-primary" asChild>
          <Link href={`/dashboard/clients/${entry.profile_id}/workspace/case-management`}>
            Open
            <ArrowUpRight className="ml-0.5 size-3" />
          </Link>
        </Button>
      </div>
      {entry.agreement_signed_at && (
        <p className="mt-1.5 text-[10px] text-muted-foreground">Signed {fmtDate(entry.agreement_signed_at)}</p>
      )}
    </div>
  );
}

function BoardCustomizeDialog({
  config,
  onSave,
}: {
  config: PipelineBoardConfig;
  onSave: (next: PipelineBoardConfig) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(config);
  const [newLabel, setNewLabel] = useState("");
  const [newStatusKey, setNewStatusKey] = useState<PipelineStatusKey | "">("");

  useEffect(() => {
    if (open) setDraft(config);
  }, [open, config]);

  const available = useMemo(() => availableStatusKeys(draft), [draft]);

  const moveColumn = (id: string, dir: -1 | 1) => {
    const idx = draft.order.indexOf(id);
    if (idx < 0) return;
    const next = idx + dir;
    if (next < 0 || next >= draft.order.length) return;
    const order = [...draft.order];
    [order[idx], order[next]] = [order[next], order[idx]];
    setDraft({ ...draft, order });
  };

  const renameColumn = (id: string, label: string) => {
    const col = draft.columns[id];
    if (!col) return;
    setDraft({ ...draft, columns: { ...draft.columns, [id]: { ...col, label } } });
  };

  const hideColumn = (id: string) => {
    const col = draft.columns[id];
    if (!col) return;
    setDraft({ ...draft, columns: { ...draft.columns, [id]: { ...col, hidden: true } } });
  };

  const showHiddenColumn = (id: string) => {
    const col = draft.columns[id];
    if (!col) return;
    setDraft({ ...draft, columns: { ...draft.columns, [id]: { ...col, hidden: false } } });
  };

  const removeCustomColumn = (id: string) => {
    const col = draft.columns[id];
    if (!col?.isCustom) return;
    const { [id]: _, ...rest } = draft.columns;
    setDraft({ order: draft.order.filter((x) => x !== id), columns: rest });
  };

  const handleAddColumn = () => {
    if (!newStatusKey) return;
    setDraft(addCustomColumn(draft, newLabel, newStatusKey));
    setNewLabel("");
    setNewStatusKey("");
  };

  const hiddenColumns = draft.order.filter((id) => draft.columns[id]?.hidden);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="shrink-0 gap-1.5">
          <Settings2 className="size-3.5" />
          Customize board
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Customize your board</DialogTitle>
          <DialogDescription>
            Reorder columns, rename stages, or add a column for a workflow stage. Changes are saved on this device.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Visible columns</Label>
          {draft.order
            .filter((id) => !draft.columns[id]?.hidden)
            .map((id) => {
              const col = draft.columns[id];
              if (!col) return null;
              return (
                <div key={id} className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/30 px-2.5 py-2">
                  <div className="flex flex-col gap-0.5">
                    <Button type="button" variant="ghost" size="icon" className="size-6" onClick={() => moveColumn(id, -1)}>
                      <ChevronUp className="size-3.5" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="size-6" onClick={() => moveColumn(id, 1)}>
                      <ChevronDown className="size-3.5" />
                    </Button>
                  </div>
                  <Input value={col.label} onChange={(e) => renameColumn(id, e.target.value)} className="h-8 flex-1 text-sm" />
                  <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => hideColumn(id)} title="Hide column">
                    <EyeOff className="size-3.5" />
                  </Button>
                  {col.isCustom && (
                    <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0 text-destructive/70" onClick={() => removeCustomColumn(id)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              );
            })}
        </div>
        {hiddenColumns.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Hidden columns</Label>
            {hiddenColumns.map((id) => (
              <div key={id} className="flex items-center justify-between rounded-lg border border-dashed px-3 py-2">
                <span className="text-sm text-muted-foreground">{draft.columns[id]?.label}</span>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => showHiddenColumn(id)}>
                  Show
                </Button>
              </div>
            ))}
          </div>
        )}
        {available.length > 0 && (
          <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-3">
            <Label className="text-xs font-medium">Add column</Label>
            <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Column name (optional)" className="h-8 text-sm" />
            <Select value={newStatusKey} onValueChange={(v) => setNewStatusKey(v as PipelineStatusKey)}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Select stage…" />
              </SelectTrigger>
              <SelectContent>
                {available.map((key) => (
                  <SelectItem key={key} value={key}>
                    {DEFAULT_COLUMN_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" size="sm" className="w-full gap-1.5" disabled={!newStatusKey} onClick={handleAddColumn}>
              <Plus className="size-3.5" />
              Add column
            </Button>
          </div>
        )}
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            onClick={() => {
              const fresh = defaultBoardConfig();
              setDraft(fresh);
              onSave(fresh);
              setOpen(false);
            }}
          >
            <RotateCcw className="size-3.5" />
            Reset to default
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              onSave(draft);
              setOpen(false);
            }}
          >
            Save layout
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ClientPipelineBoard({
  searchQuery = "",
  embedded = false,
  showToolbar = true,
  showStats = true,
}: {
  searchQuery?: string;
  embedded?: boolean;
  showToolbar?: boolean;
  showStats?: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pipeline, setPipeline] = useState<PipelineEntry[]>([]);
  const [dragging, setDragging] = useState<PipelineEntry | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [boardConfig, setBoardConfig] = useState<PipelineBoardConfig>(() => defaultBoardConfig());

  useEffect(() => {
    setBoardConfig(loadBoardConfig());
  }, []);

  const visibleColumns = useMemo(() => visibleBoardColumns(boardConfig), [boardConfig]);

  const saveConfig = (next: PipelineBoardConfig) => {
    setBoardConfig(next);
    saveBoardConfig(next);
  };

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/consultant/case-pipeline`, { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to load pipeline.");
      setPipeline(json.pipeline ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredPipeline = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return pipeline;
    return pipeline.filter(
      (p) =>
        p.client_name.toLowerCase().includes(q) ||
        p.client_email.toLowerCase().includes(q) ||
        (p.immigration_pathway ?? "").toLowerCase().includes(q),
    );
  }, [pipeline, searchQuery]);

  const stats = useMemo(() => {
    const pendingDocs = pipeline.reduce((sum, p) => sum + p.pending_docs, 0);
    const ready = pipeline.filter((p) => p.status === "READY_FOR_SUBMISSION").length;
    const submitted = pipeline.filter((p) => p.status === "APPLICATION_SUBMITTED").length;
    return { total: pipeline.length, pendingDocs, ready, submitted };
  }, [pipeline]);

  const onDragStart = (e: React.DragEvent, entry: PipelineEntry) => {
    setDragging(entry);
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTarget(columnId);
  };

  const onDrop = async (e: React.DragEvent, column: PipelineBoardColumn) => {
    e.preventDefault();
    setDropTarget(null);
    const targetStatus = column.statusKey;
    if (!dragging || dragging.status === targetStatus) {
      setDragging(null);
      return;
    }
    const entry = dragging;
    setDragging(null);
    setPipeline((prev) =>
      prev.map((p) => (p.profile_id === entry.profile_id ? { ...p, status: targetStatus } : p)),
    );
    try {
      const res = await fetch(`${API}/consultant/clients/${entry.profile_id}/case-pipeline`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ status: targetStatus }),
      });
      const json = await res.json();
      if (!res.ok) {
        setPipeline((prev) =>
          prev.map((p) => (p.profile_id === entry.profile_id ? { ...p, status: entry.status } : p)),
        );
        showToast(json.message ?? "Failed to update.", "error");
      } else {
        showToast(`${entry.client_name} → ${column.label}`);
      }
    } catch {
      setPipeline((prev) =>
        prev.map((p) => (p.profile_id === entry.profile_id ? { ...p, status: entry.status } : p)),
      );
      showToast("Failed to update status.", "error");
    }
  };

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground", embedded && "py-12")}>
        <Loader2 className="size-5 animate-spin" />
        Loading application board…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <AlertCircle className="size-10 text-destructive/80" />
        <p className="text-sm font-medium text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="mr-1.5 size-3.5" />
          Try again
        </Button>
      </div>
    );
  }

  const gridCols = visibleColumns.length <= 1 ? "1fr" : `repeat(${visibleColumns.length}, minmax(0, 1fr))`;

  return (
    <div className="space-y-4">
      {toast && (
        <div
          className={cn(
            "fixed top-4 right-4 z-50 flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm shadow-lg backdrop-blur-sm",
            toast.type === "success"
              ? "border-emerald-200/80 bg-background text-emerald-800"
              : "border-red-200/80 bg-background text-red-700",
          )}
        >
          {toast.type === "success" ? <Check className="size-4 shrink-0" /> : <AlertCircle className="size-4 shrink-0" />}
          {toast.msg}
        </div>
      )}

      {showToolbar && (
        <div className="flex flex-wrap items-center gap-2">
          <BoardCustomizeDialog config={boardConfig} onSave={saveConfig} />
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="mr-1.5 size-3.5" />
            Refresh board
          </Button>
        </div>
      )}

      {showStats && pipeline.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "On board", value: stats.total, icon: Users },
            { label: "Pending docs", value: stats.pendingDocs, icon: Clock },
            { label: "Ready to submit", value: stats.ready, icon: CheckCircle2 },
            { label: "Submitted", value: stats.submitted, icon: Send },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-background/80 px-3 py-2.5">
              <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <s.icon className="size-3.5" />
              </span>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{s.label}</p>
                <p className="text-lg font-bold tabular-nums leading-none">{s.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {pipeline.length === 0 ? (
        <Card className="border-dashed border-border/70 shadow-none">
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <Briefcase className="size-7 opacity-50" />
            </span>
            <div className="space-y-1">
              <p className="font-semibold">No clients on the board yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Clients appear here after they sign their retainer agreement.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="w-full overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:thin]">
          <div
            className="grid w-full min-w-0 gap-3"
            style={{ gridTemplateColumns: gridCols, minWidth: `${visibleColumns.length * 200}px` }}
          >
            {visibleColumns.map((col) => {
              const theme = STATUS_THEMES[col.statusKey];
              const Icon = theme.icon;
              const cards = filteredPipeline.filter((p) => p.status === col.statusKey);
              const isOver = dropTarget === col.id;
              return (
                <div
                  key={col.id}
                  onDragOver={(e) => onDragOver(e, col.id)}
                  onDragLeave={() => setDropTarget(null)}
                  onDrop={(e) => void onDrop(e, col)}
                  className={cn(
                    "flex min-h-[min(24rem,55vh)] min-w-0 flex-col overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm transition-all",
                    isOver && "scale-[1.005] border-primary border-dashed ring-2 ring-primary/25 shadow-md",
                  )}
                >
                  <div className={cn("flex items-center gap-2.5 border-b px-3 py-3", theme.accentBar)}>
                    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", theme.iconClass)}>
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate text-sm font-semibold leading-tight", theme.headerClass)}>{col.label}</p>
                      <p className="text-[10px] text-muted-foreground">{theme.shortLabel}</p>
                    </div>
                    <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold tabular-nums", theme.badgeClass)}>
                      {cards.length}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-2 overflow-y-auto bg-muted/10 p-2.5">
                    {cards.map((entry) => (
                      <ClientCard key={entry.profile_id} entry={entry} onDragStart={onDragStart} />
                    ))}
                    {cards.length === 0 && (
                      <div className={cn("flex flex-1 items-center justify-center rounded-lg border border-dashed px-3 py-10", theme.dropZoneClass)}>
                        <p className="text-center text-xs text-muted-foreground">
                          {searchQuery.trim() ? "No matches" : "Drop client here"}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
