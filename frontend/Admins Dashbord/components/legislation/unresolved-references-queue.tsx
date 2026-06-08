"use client";

import * as React from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Eye,
  Loader2,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminAuthHeaders } from "@/lib/admin-auth";
import type { ResolvedProvision } from "@/components/legislation/admin-legislation-viewer";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

type PendingRef = {
  id: number;
  label: string;
  target_act_code: string | null;
  target_provision_key: string | null;
  admin_notes: string | null;
  source_type: string;
};

export function UnresolvedReferencesQueue({
  documentId,
  language,
  onChanged,
}: {
  documentId: number;
  language: string;
  onChanged?: () => void;
}) {
  const [open, setOpen] = React.useState(true);
  const [loading, setLoading] = React.useState(true);
  const [acting, setActing] = React.useState<number | null>(null);
  const [refs, setRefs] = React.useState<PendingRef[]>([]);
  const [message, setMessage] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [editAct, setEditAct] = React.useState("");
  const [editKey, setEditKey] = React.useState("");
  const [preview, setPreview] = React.useState<ResolvedProvision | null>(null);
  const [previewError, setPreviewError] = React.useState<string | null>(null);

  const loadQueue = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${API}/admin/legislation/documents/${documentId}/references?status=pending`,
        { headers: adminAuthHeaders() },
      );
      const json = await res.json();
      if (res.ok) {
        setRefs((json.data ?? []) as PendingRef[]);
      }
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  React.useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const startEdit = (ref: PendingRef) => {
    setEditingId(ref.id);
    setEditAct(ref.target_act_code ?? "");
    setEditKey(ref.target_provision_key ?? "");
    setMessage(null);
  };

  const saveEdit = async (refId: number) => {
    setActing(refId);
    setMessage(null);
    try {
      const res = await fetch(`${API}/admin/legislation/references/${refId}`, {
        method: "PUT",
        headers: adminAuthHeaders("application/json"),
        body: JSON.stringify({
          target_act_code: editAct || null,
          target_provision_key: editKey || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Update failed");
      setEditingId(null);
      await loadQueue();
      setMessage("Target updated.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Update failed");
    } finally {
      setActing(null);
    }
  };

  const activateRef = async (ref: PendingRef) => {
    setActing(ref.id);
    setMessage(null);
    try {
      const res = await fetch(`${API}/admin/legislation/references/${ref.id}/activate`, {
        method: "POST",
        headers: adminAuthHeaders(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Activation failed");
      await loadQueue();
      onChanged?.();
      setMessage(`Activated: ${ref.label}`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Activation failed");
    } finally {
      setActing(null);
    }
  };

  const deleteRef = async (ref: PendingRef) => {
    if (!confirm(`Remove queued reference "${ref.label}"?`)) return;
    setActing(ref.id);
    setMessage(null);
    try {
      const res = await fetch(`${API}/admin/legislation/references/${ref.id}`, {
        method: "DELETE",
        headers: adminAuthHeaders(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Delete failed");
      await loadQueue();
      setMessage("Removed from queue.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setActing(null);
    }
  };

  const previewRef = async (ref: PendingRef) => {
    if (!ref.target_act_code || !ref.target_provision_key) return;
    setPreview(null);
    setPreviewError(null);
    setActing(ref.id);
    try {
      const params = new URLSearchParams({
        act: ref.target_act_code,
        key: ref.target_provision_key,
        language,
      });
      const res = await fetch(`${API}/admin/legislation/references/preview?${params}`, {
        headers: adminAuthHeaders(),
      });
      const json = await res.json();
      if (!res.ok) {
        setPreviewError(json.message ?? "Provision not in catalog.");
        return;
      }
      setPreview(json.data as ResolvedProvision);
    } catch {
      setPreviewError("Could not load preview.");
    } finally {
      setActing(null);
    }
  };

  if (!loading && refs.length === 0) {
    return null;
  }

  return (
    <>
      <Collapsible open={open} onOpenChange={setOpen} className="rounded-xl border bg-amber-50/50 dark:bg-amber-950/20">
        <Card className="border-0 bg-transparent shadow-none">
          <CardHeader className="pb-3">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-start justify-between gap-3 text-left"
              >
                <div className="space-y-1">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    Unresolved reference queue
                    {!loading && (
                      <Badge variant="secondary" className="font-normal">
                        {refs.length}
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Phrases detected but not in the synced catalog. Fix the target or sync more provisions, then activate.
                  </CardDescription>
                </div>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
                />
              </button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-3 pt-0">
              {message && (
                <p className="text-xs rounded-md border bg-background px-3 py-2">{message}</p>
              )}
              <div className="rounded-md border bg-background">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Label</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Note</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-8 text-center">
                          <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    ) : (
                      refs.map((ref) => (
                        <TableRow key={ref.id}>
                          <TableCell className="font-medium text-sm max-w-[200px]">
                            {ref.label}
                          </TableCell>
                          <TableCell className="text-xs font-mono">
                            {editingId === ref.id ? (
                              <div className="flex flex-col gap-1.5 min-w-[140px]">
                                <Input
                                  value={editAct}
                                  onChange={(e) => setEditAct(e.target.value)}
                                  placeholder="Act code"
                                  className="h-7 text-xs"
                                />
                                <Input
                                  value={editKey}
                                  onChange={(e) => setEditKey(e.target.value)}
                                  placeholder="Provision key"
                                  className="h-7 text-xs"
                                />
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    className="h-7 text-xs"
                                    disabled={acting === ref.id}
                                    onClick={() => saveEdit(ref.id)}
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-xs"
                                    onClick={() => setEditingId(null)}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <>
                                {ref.target_act_code ?? "—"}
                                {ref.target_provision_key ? `:${ref.target_provision_key}` : ""}
                              </>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">
                            {ref.admin_notes ?? "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {ref.target_act_code && ref.target_provision_key && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  title="Preview target"
                                  disabled={acting === ref.id}
                                  onClick={() => previewRef(ref)}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs"
                                disabled={acting === ref.id}
                                onClick={() => startEdit(ref)}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                className="h-8 text-xs"
                                disabled={acting === ref.id}
                                onClick={() => activateRef(ref)}
                              >
                                {acting === ref.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <>
                                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                    Activate
                                  </>
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                disabled={acting === ref.id}
                                onClick={() => deleteRef(ref)}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Dialog open={!!preview || !!previewError} onOpenChange={() => { setPreview(null); setPreviewError(null); }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Provision preview</DialogTitle>
            <DialogDescription>
              {preview ? preview.citation : "Target not found in catalog"}
            </DialogDescription>
          </DialogHeader>
          {previewError && (
            <p className="text-sm text-destructive">{previewError}</p>
          )}
          {preview && (
            <div
              className="prose prose-sm dark:prose-invert max-w-none text-sm"
              dangerouslySetInnerHTML={{
                __html: preview.popup_html ?? preview.html_fragment ?? preview.text_content,
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
