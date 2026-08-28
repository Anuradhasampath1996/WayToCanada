"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PauseCircle, PlayCircle, XCircle, CheckCircle2, FolderPlus,
  Trash2, Loader2, AlertTriangle, FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface CaseFileSummary {
  id: number;
  case_number: number;
  name?: string | null;
  label: string;
  status: string;
  lifecycle_status: string;
  lifecycle_label: string;
  lifecycle_note?: string | null;
  lifecycle_changed_at?: string | null;
  immigration_pathway?: string | null;
  is_active: boolean;
  is_focused?: boolean;
  is_lifecycle_active?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface CaseLifecycleMeta {
  status: string;
  label: string;
  note?: string | null;
  changed_at?: string | null;
  can_hold: boolean;
  can_resume: boolean;
  can_close: boolean;
  can_complete: boolean;
  can_open_new_case: boolean;
  case_count: number;
}

const WORKFLOW_STATUS_LABELS: Record<string, string> = {
  PENDING_ASSESSMENT: "Pending assessment",
  PATHWAY_SELECTED: "Pathway selected",
  AGREEMENT_SENT: "Agreement sent",
  AGREEMENT_SIGNED: "Agreement signed",
  DOCUMENTS_UPLOADING: "Documents uploading",
  UNDER_REVIEW: "Under review",
  READY_FOR_SUBMISSION: "Ready for submission",
  APPLICATION_SUBMITTED: "Application submitted",
};

type LifecycleAction = "hold" | "resume" | "close" | "complete";

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function workflowLabel(status: string) {
  return WORKFLOW_STATUS_LABELS[status] ?? status.replaceAll("_", " ");
}

function lifecycleEventLabel(status: string) {
  switch (status) {
    case "on_hold":
      return "On hold since";
    case "closed":
      return "Closed on";
    case "completed":
      return "Completed on";
    case "active":
      return "Active since";
    default:
      return "Updated on";
  }
}

function lifecycleStatusTitle(status: string) {
  switch (status) {
    case "active":
      return "ACTIVE";
    case "on_hold":
      return "ON HOLD";
    case "closed":
      return "CLOSED";
    case "completed":
      return "COMPLETED";
    default:
      return status.toUpperCase();
  }
}

function rowShellClass(status: string, isFocused: boolean) {
  if (isFocused && status === "active") {
    return "border-emerald-500 bg-emerald-50 shadow-sm ring-2 ring-emerald-400/40";
  }
  if (status === "on_hold") {
    return "border-amber-300 bg-amber-50/80";
  }
  if (status === "closed") {
    return "border-slate-300 bg-slate-100/80 opacity-90";
  }
  if (status === "completed") {
    return "border-blue-300 bg-blue-50/80";
  }
  if (isFocused) {
    return "border-emerald-400 bg-emerald-50/60 ring-1 ring-emerald-300";
  }
  return "border-border bg-background";
}

function statusBannerClass(status: string) {
  switch (status) {
    case "active":
      return "bg-emerald-600 text-white";
    case "on_hold":
      return "bg-amber-500 text-white";
    case "closed":
      return "bg-slate-600 text-white";
    case "completed":
      return "bg-blue-600 text-white";
    default:
      return "bg-slate-500 text-white";
  }
}

export function CaseLifecyclePanel({
  profileId,
  clientName,
  caseFiles,
  lifecycle,
  getAuthHeaders,
  onUpdated,
}: {
  profileId: string;
  clientName: string;
  caseFiles: CaseFileSummary[];
  lifecycle: CaseLifecycleMeta | null;
  activeCaseNumber?: number;
  getAuthHeaders: () => Record<string, string>;
  onUpdated: () => void | Promise<void>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [actionDialog, setActionDialog] = useState<LifecycleAction | null>(null);
  const [note, setNote] = useState("");
  const [newCaseOpen, setNewCaseOpen] = useState(false);
  const [newCaseName, setNewCaseName] = useState("");
  const [newCaseNote, setNewCaseNote] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  const focusedCase = useMemo(
    () => caseFiles.find((c) => c.is_active) ?? caseFiles[0] ?? null,
    [caseFiles],
  );

  const sortedCases = useMemo(
    () => [...caseFiles].sort((a, b) => b.case_number - a.case_number),
    [caseFiles],
  );

  const api = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

  const runLifecycle = async (action: LifecycleAction) => {
    if ((action === "hold" || action === "close" || action === "complete") && !note.trim()) {
      setError("Please enter a reason / note before confirming.");
      return;
    }
    setBusy(action);
    setError("");
    try {
      const res = await fetch(`${api}/consultant/clients/${profileId}/case-file/lifecycle`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ action, note: note.trim() || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to update case.");
      setActionDialog(null);
      setNote("");
      await onUpdated();
      if (action === "resume") {
        router.refresh();
        window.location.reload();
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to update case.");
    } finally {
      setBusy(null);
    }
  };

  const openNewCase = async () => {
    const trimmed = newCaseName.trim();
    if (!trimmed) {
      setError("Enter a case name before opening a new case.");
      return;
    }
    setBusy("open-new");
    setError("");
    try {
      const res = await fetch(`${api}/consultant/clients/${profileId}/case-file/open-new`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: trimmed,
          note: newCaseNote.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const fieldError = json?.errors?.name?.[0];
        throw new Error(fieldError ?? json.message ?? "Could not open new case.");
      }
      setNewCaseOpen(false);
      setNewCaseName("");
      setNewCaseNote("");
      await onUpdated();
      router.refresh();
      window.location.reload();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not open new case.");
    } finally {
      setBusy(null);
    }
  };

  const switchCase = async (caseFileId: number) => {
    setBusy(`switch-${caseFileId}`);
    setError("");
    try {
      const res = await fetch(`${api}/consultant/clients/${profileId}/case-file/switch`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ case_file_id: caseFileId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Could not switch case.");
      await onUpdated();
      router.refresh();
      window.location.reload();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not switch case.");
    } finally {
      setBusy(null);
    }
  };

  const deleteClient = async () => {
    if (deleteConfirm.trim() !== clientName.trim()) return;
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`${api}/consultant/clients/${profileId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Could not delete client.");
      setDeleteOpen(false);
      router.push("/dashboard/clients");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not delete client.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-base">Case management</CardTitle>
              <CardDescription>
                All cases for this client. The highlighted case is what the client portal shows.
                Opening a new case puts other active cases on hold.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs shrink-0">
              {lifecycle?.case_count ?? caseFiles.length} case{(lifecycle?.case_count ?? caseFiles.length) === 1 ? "" : "s"}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* ── Case list ─────────────────────────────────────────────── */}
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Case list
              </h3>
              {(lifecycle?.can_open_new_case ?? true) && (
                <Button
                  size="sm"
                  className="gap-1.5"
                  disabled={busy !== null}
                  onClick={() => {
                    setError("");
                    setNewCaseName("");
                    setNewCaseNote("");
                    setNewCaseOpen(true);
                  }}
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                  Open new case
                </Button>
              )}
            </div>

            {sortedCases.length === 0 ? (
              <div className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                No cases yet. Open the first case to start this client&apos;s workflow.
              </div>
            ) : (
              <ul className="space-y-3">
                {sortedCases.map((c) => {
                  const isFocused = c.is_focused ?? c.is_active;
                  const life = c.lifecycle_status;
                  const reason = (c.lifecycle_note || "").trim();
                  return (
                    <li
                      key={c.id}
                      className={cn(
                        "overflow-hidden rounded-xl border-2",
                        rowShellClass(life, isFocused),
                      )}
                    >
                      <div className={cn("px-3 py-1.5 text-[11px] font-bold tracking-wide", statusBannerClass(life))}>
                        {lifecycleStatusTitle(life)}
                        {isFocused ? "  ·  CLIENT PORTAL CASE" : ""}
                      </div>

                      <div className="space-y-3 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <FolderOpen className="h-4 w-4 shrink-0 text-foreground/70" />
                              <span className="text-base font-semibold truncate">{c.label}</span>
                              <span className="rounded bg-black/5 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                                Case #{c.case_number}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground pl-6">
                              Workflow stage: <span className="font-medium text-foreground">{workflowLabel(c.status)}</span>
                              {" · "}
                              Pathway:{" "}
                              <span className="font-medium text-foreground">
                                {c.immigration_pathway || "Not assigned"}
                              </span>
                            </p>
                          </div>

                          {!isFocused && (
                            <Button
                              size="sm"
                              variant={life === "on_hold" ? "default" : "outline"}
                              disabled={busy !== null}
                              onClick={() => void switchCase(c.id)}
                              className="shrink-0 gap-1.5"
                            >
                              {busy === `switch-${c.id}` ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : life === "on_hold" ? (
                                <PlayCircle className="h-3.5 w-3.5" />
                              ) : null}
                              {life === "on_hold" ? "Resume & focus" : "Switch focus"}
                            </Button>
                          )}
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="rounded-lg border border-black/5 bg-white/70 px-3 py-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Opened on
                            </p>
                            <p className="text-sm font-medium">{formatDateTime(c.created_at)}</p>
                          </div>
                          <div className="rounded-lg border border-black/5 bg-white/70 px-3 py-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {lifecycleEventLabel(life)}
                            </p>
                            <p className="text-sm font-medium">{formatDateTime(c.lifecycle_changed_at)}</p>
                          </div>
                        </div>

                        {(life === "on_hold" || life === "closed" || life === "completed") && (
                          <div
                            className={cn(
                              "rounded-lg border px-3 py-2 text-xs",
                              life === "on_hold" && "border-amber-300 bg-amber-100/70 text-amber-950",
                              life === "closed" && "border-slate-300 bg-slate-200/60 text-slate-800",
                              life === "completed" && "border-blue-300 bg-blue-100/70 text-blue-950",
                            )}
                          >
                            <p className="font-semibold">
                              {life === "on_hold" && "Reason for hold"}
                              {life === "closed" && "Reason for closing"}
                              {life === "completed" && "Completion note"}
                            </p>
                            <p className="mt-0.5 whitespace-pre-wrap">
                              {reason || "No reason recorded for this status change."}
                            </p>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* ── Actions ───────────────────────────────────────────────── */}
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Actions for client portal case
              {focusedCase ? ` — ${focusedCase.label}` : ""}
            </h3>
            <div className="flex flex-wrap gap-2 rounded-xl border bg-muted/20 p-3">
              {lifecycle?.can_hold && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  disabled={busy !== null}
                  onClick={() => { setNote(""); setActionDialog("hold"); }}
                >
                  <PauseCircle className="h-3.5 w-3.5" /> Put on hold
                </Button>
              )}
              {lifecycle?.can_resume && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                  disabled={busy !== null}
                  onClick={() => void runLifecycle("resume")}
                >
                  {busy === "resume" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
                  Resume case
                </Button>
              )}
              {lifecycle?.can_close && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  disabled={busy !== null}
                  onClick={() => { setNote(""); setActionDialog("close"); }}
                >
                  <XCircle className="h-3.5 w-3.5" /> Close case
                </Button>
              )}
              {lifecycle?.can_complete && (
                <Button
                  size="sm"
                  className="gap-1.5"
                  disabled={busy !== null}
                  onClick={() => { setNote(""); setActionDialog("complete"); }}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Mark complete
                </Button>
              )}
              {(lifecycle?.can_open_new_case ?? true) && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="gap-1.5"
                  disabled={busy !== null}
                  onClick={() => {
                    setError("");
                    setNewCaseName("");
                    setNewCaseNote("");
                    setNewCaseOpen(true);
                  }}
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                  Open new case
                </Button>
              )}
            </div>
          </section>

          <div className="border-t pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Danger zone</p>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-red-200 text-red-700 hover:bg-red-50"
              onClick={() => { setDeleteConfirm(""); setDeleteOpen(true); }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Permanently delete client
            </Button>
          </div>

          {error && (
            <p className="text-xs text-red-600">{error}</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={actionDialog !== null} onOpenChange={(open) => { if (!open) setActionDialog(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {actionDialog === "hold" && "Put case on hold"}
              {actionDialog === "close" && "Close case"}
              {actionDialog === "complete" && "Mark case complete"}
            </DialogTitle>
            <DialogDescription>
              {actionDialog === "hold" && "Work pauses until you resume. A reason is required and will show on this case."}
              {actionDialog === "close" && "Close this case if it will not continue. A reason is required."}
              {actionDialog === "complete" && "Mark as complete when finished. A completion note is required."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Reason / note (required)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                actionDialog === "hold"
                  ? "e.g. Waiting for new documents / client travelling"
                  : actionDialog === "close"
                    ? "e.g. Client withdrew / wrong pathway"
                    : "e.g. PR approved / application submitted to IRCC"
              }
              className="min-h-[88px] w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Cancel</Button>
            <Button
              disabled={busy !== null || !actionDialog || !note.trim()}
              onClick={() => actionDialog && void runLifecycle(actionDialog)}
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newCaseOpen} onOpenChange={setNewCaseOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Open new case</DialogTitle>
            <DialogDescription>
              Give this case a clear name (e.g. Express Entry 2026). Any currently active case for this
              client will be put on hold. Questionnaire data stays shared for the same client.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="new-case-name">
                Case name
              </label>
              <input
                id="new-case-name"
                type="text"
                value={newCaseName}
                onChange={(e) => setNewCaseName(e.target.value)}
                placeholder="e.g. Express Entry — PR"
                maxLength={120}
                className="h-10 w-full rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="new-case-note">
                Optional note
              </label>
              <textarea
                id="new-case-note"
                value={newCaseNote}
                onChange={(e) => setNewCaseNote(e.target.value)}
                placeholder="Why this case is opening (optional)"
                className="min-h-[72px] w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewCaseOpen(false)}>Cancel</Button>
            <Button
              disabled={busy !== null || !newCaseName.trim()}
              onClick={() => void openNewCase()}
            >
              {busy === "open-new" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FolderPlus className="mr-2 h-4 w-4" />}
              Create case
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              Permanently delete client
            </DialogTitle>
            <DialogDescription>
              This removes <strong>{clientName}</strong>, their profile, cases, and portal account. This cannot be undone.
              Type the client&apos;s full name to confirm.
            </DialogDescription>
          </DialogHeader>
          <input
            type="text"
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder={clientName}
            className="h-10 w-full rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleting || deleteConfirm.trim() !== clientName.trim()}
              onClick={() => void deleteClient()}
            >
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
