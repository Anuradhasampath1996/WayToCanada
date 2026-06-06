"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Loader2, AlertCircle, RefreshCw, Check, User,
  FileText, Clock, CheckCircle2, Briefcase, Send, ClipboardCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

// ── Types ──────────────────────────────────────────────────────────────────────

interface PipelineEntry {
  profile_id: number;
  client_name: string;
  client_email: string;
  status: string;
  immigration_pathway: string | null;
  agreement_signed_at: string | null;
  pending_docs: number;
  case_file_id: number;
}

// ── Pipeline columns ───────────────────────────────────────────────────────────

const COLUMNS: { id: string; label: string; icon: React.ReactNode; color: string }[] = [
  { id: "AGREEMENT_SIGNED",      label: "Retainer Signed",       icon: <FileText className="h-4 w-4" />,       color: "bg-blue-50 border-blue-200" },
  { id: "DOCUMENTS_UPLOADING",   label: "Documents Uploading",   icon: <Clock className="h-4 w-4" />,           color: "bg-amber-50 border-amber-200" },
  { id: "UNDER_REVIEW",          label: "Under Review",          icon: <ClipboardCheck className="h-4 w-4" />, color: "bg-purple-50 border-purple-200" },
  { id: "READY_FOR_SUBMISSION",  label: "Ready for Submission",  icon: <CheckCircle2 className="h-4 w-4" />,   color: "bg-green-50 border-green-200" },
  { id: "APPLICATION_SUBMITTED", label: "Application Submitted", icon: <Send className="h-4 w-4" />,            color: "bg-gray-50 border-gray-200" },
];

const COLUMN_HEADER_COLORS: Record<string, string> = {
  AGREEMENT_SIGNED:      "text-blue-700",
  DOCUMENTS_UPLOADING:   "text-amber-700",
  UNDER_REVIEW:          "text-purple-700",
  READY_FOR_SUBMISSION:  "text-green-700",
  APPLICATION_SUBMITTED: "text-gray-600",
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("wtc_consultant_token") : null;
  return {
    "Content-Type": "application/json",
    "Accept": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function fmtDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

// ── Draggable card ─────────────────────────────────────────────────────────────

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
      onDragStart={e => onDragStart(e, entry)}
      className="bg-background rounded-xl border p-3 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow select-none"
    >
      <div className="flex items-start gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0 mt-0.5">
          <User className="h-3.5 w-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{entry.client_name}</p>
          <p className="text-xs text-muted-foreground truncate">{entry.client_email}</p>
        </div>
      </div>

      {entry.immigration_pathway && (
        <Badge variant="outline" className="mt-2 text-[10px] py-0 h-4">
          {entry.immigration_pathway}
        </Badge>
      )}

      <div className="flex items-center justify-between mt-2">
        {entry.pending_docs > 0 ? (
          <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5">
            {entry.pending_docs} docs pending
          </span>
        ) : (
          <span className="text-[10px] text-green-700 bg-green-50 border border-green-200 rounded-full px-1.5 py-0.5">
            <Check className="inline h-2.5 w-2.5 mr-0.5" />All reviewed
          </span>
        )}

        <Link href={`/dashboard/clients/${entry.profile_id}/workspace/case-management`}>
          <button className="text-[10px] text-primary hover:underline">Open →</button>
        </Link>
      </div>

      {entry.agreement_signed_at && (
        <p className="text-[10px] text-muted-foreground mt-1">Signed {fmtDate(entry.agreement_signed_at)}</p>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function CasePipelineClient() {
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [pipeline, setPipeline] = useState<PipelineEntry[]>([]);
  const [dragging, setDragging] = useState<PipelineEntry | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [toast, setToast]       = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res  = await fetch(`${API}/consultant/case-pipeline`, { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to load pipeline.");
      setPipeline(json.pipeline ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onDragStart = (e: React.DragEvent, entry: PipelineEntry) => {
    setDragging(entry);
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTarget(columnId);
  };

  const onDrop = async (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    setDropTarget(null);
    if (!dragging || dragging.status === targetStatus) { setDragging(null); return; }

    const entry = dragging;
    setDragging(null);

    // Optimistic UI update
    setPipeline(prev => prev.map(p => p.profile_id === entry.profile_id ? { ...p, status: targetStatus } : p));

    try {
      const res = await fetch(`${API}/consultant/clients/${entry.profile_id}/case-pipeline`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ status: targetStatus }),
      });
      const json = await res.json();
      if (!res.ok) {
        // Revert on failure
        setPipeline(prev => prev.map(p => p.profile_id === entry.profile_id ? { ...p, status: entry.status } : p));
        showToast(json.message ?? "Failed to update.", "error");
      } else {
        showToast(`${entry.client_name} moved to ${COLUMNS.find(c => c.id === targetStatus)?.label ?? targetStatus}`);
      }
    } catch {
      setPipeline(prev => prev.map(p => p.profile_id === entry.profile_id ? { ...p, status: entry.status } : p));
      showToast("Failed to update status.", "error");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-40">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-4 text-center">
        <AlertCircle className="h-10 w-10 text-red-400" />
        <p className="text-lg font-semibold">{error}</p>
        <Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button>
      </div>
    );
  }

  return (
    <div className="pb-16">
      {/* Toast */}
      {toast && (
        <div className={cn(
          "fixed top-4 right-4 z-50 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg",
          toast.type === "success" ? "bg-white border-green-200 text-green-800" : "bg-white border-red-200 text-red-700"
        )}>
          {toast.type === "success" ? <Check className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Briefcase className="h-6 w-6" />
            Case Pipeline
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Drag and drop clients between stages to track progress
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Refresh
        </Button>
      </div>

      {pipeline.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center border rounded-2xl bg-muted/10">
          <Briefcase className="h-12 w-12 text-muted-foreground/40" />
          <p className="font-semibold text-muted-foreground">No clients in the pipeline yet</p>
          <p className="text-sm text-muted-foreground/70">Clients appear here once they sign their retainer agreement.</p>
        </div>
      ) : (
        /* Kanban board */
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map(col => {
            const cards = pipeline.filter(p => p.status === col.id);
            const isOver = dropTarget === col.id;
            return (
              <div
                key={col.id}
                onDragOver={e => onDragOver(e, col.id)}
                onDragLeave={() => setDropTarget(null)}
                onDrop={e => onDrop(e, col.id)}
                className={cn(
                  "flex flex-col rounded-2xl border-2 p-3 min-w-[220px] w-[220px] shrink-0 transition-colors",
                  col.color,
                  isOver && "border-primary border-dashed bg-primary/5"
                )}
              >
                {/* Column header */}
                <div className={cn("flex items-center gap-2 mb-3", COLUMN_HEADER_COLORS[col.id])}>
                  {col.icon}
                  <span className="text-xs font-semibold">{col.label}</span>
                  <span className="ml-auto text-xs bg-background rounded-full h-5 w-5 flex items-center justify-center border font-medium">
                    {cards.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="flex flex-col gap-2 flex-1 min-h-[100px]">
                  {cards.map(entry => (
                    <ClientCard key={entry.profile_id} entry={entry} onDragStart={onDragStart} />
                  ))}
                  {cards.length === 0 && (
                    <div className="flex-1 flex items-center justify-center">
                      <p className="text-xs text-muted-foreground/50 italic">Drop here</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
