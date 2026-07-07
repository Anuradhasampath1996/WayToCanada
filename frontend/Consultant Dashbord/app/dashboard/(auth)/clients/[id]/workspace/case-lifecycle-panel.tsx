"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  PauseCircle, PlayCircle, XCircle, CheckCircle2, FolderPlus,
  Trash2, Loader2, AlertTriangle, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface CaseFileSummary {
  id: number;
  case_number: number;
  label: string;
  status: string;
  lifecycle_status: string;
  lifecycle_label: string;
  lifecycle_note?: string | null;
  lifecycle_changed_at?: string | null;
  immigration_pathway?: string | null;
  is_active: boolean;
  created_at?: string | null;
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

const LIFECYCLE_STYLES: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-800 border-emerald-200",
  on_hold: "bg-amber-50 text-amber-800 border-amber-200",
  closed: "bg-slate-100 text-slate-700 border-slate-200",
  completed: "bg-blue-50 text-blue-800 border-blue-200",
};

type LifecycleAction = "hold" | "resume" | "close" | "complete";

export function CaseLifecyclePanel({
  profileId,
  clientName,
  caseFiles,
  lifecycle,
  activeCaseNumber,
  getAuthHeaders,
  onUpdated,
}: {
  profileId: string;
  clientName: string;
  caseFiles: CaseFileSummary[];
  lifecycle: CaseLifecycleMeta | null;
  activeCaseNumber: number;
  getAuthHeaders: () => Record<string, string>;
  onUpdated: () => void | Promise<void>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [actionDialog, setActionDialog] = useState<LifecycleAction | null>(null);
  const [note, setNote] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  const api = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

  const runLifecycle = async (action: LifecycleAction) => {
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
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to update case.");
    } finally {
      setBusy(null);
    }
  };

  const openNewCase = async () => {
    setBusy("open-new");
    setError("");
    try {
      const res = await fetch(`${api}/consultant/clients/${profileId}/case-file/open-new`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Could not open new case.");
      await onUpdated();
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

  const lifecycleStyle = LIFECYCLE_STYLES[lifecycle?.status ?? "active"] ?? LIFECYCLE_STYLES.active;

  return (
    <>
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base">Case management</CardTitle>
              <CardDescription className="mt-1">
                Close, hold, complete, or open a new case for this client.
              </CardDescription>
            </div>
            {lifecycle && (
              <Badge variant="outline" className={cn("text-xs", lifecycleStyle)}>
                {lifecycle.label}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {caseFiles.length > 1 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Active case</p>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 w-full justify-between sm:w-auto sm:min-w-[200px]">
                    Case #{activeCaseNumber}
                    <ChevronDown className="ml-2 h-4 w-4 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  {caseFiles.map((c) => (
                    <DropdownMenuItem
                      key={c.id}
                      disabled={busy !== null || c.is_active}
                      onClick={() => void switchCase(c.id)}
                    >
                      <span className="font-medium">{c.label}</span>
                      <span className="ml-auto text-[10px] text-muted-foreground capitalize">
                        {c.lifecycle_label}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          {lifecycle?.note && (
            <p className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              {lifecycle.note}
            </p>
          )}

          {lifecycle?.status === "on_hold" && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <PauseCircle className="mt-0.5 h-4 w-4 shrink-0" />
              This case is on hold. Resume when you are ready to continue work.
            </div>
          )}

          {lifecycle?.status === "closed" && (
            <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              This case is closed. You can open a new case if the client needs another application.
            </div>
          )}

          {lifecycle?.status === "completed" && (
            <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              This case is marked complete. Open a new case to start another application.
            </div>
          )}

          <div className="flex flex-wrap gap-2">
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
                className="gap-1.5"
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
            {lifecycle?.can_open_new_case && (
              <Button
                size="sm"
                variant="secondary"
                className="gap-1.5"
                disabled={busy !== null}
                onClick={() => void openNewCase()}
              >
                {busy === "open-new" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderPlus className="h-3.5 w-3.5" />}
                Open new case
              </Button>
            )}
          </div>

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
              {actionDialog === "hold" && "Work pauses until you resume. Add an optional note for your records."}
              {actionDialog === "close" && "Close this case if it will not continue. You can open a new case later."}
              {actionDialog === "complete" && "Mark as complete when the application process is finished."}
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note (visible to you on this workspace)"
            className="min-h-[88px] w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Cancel</Button>
            <Button
              disabled={busy !== null || !actionDialog}
              onClick={() => actionDialog && void runLifecycle(actionDialog)}
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirm
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
