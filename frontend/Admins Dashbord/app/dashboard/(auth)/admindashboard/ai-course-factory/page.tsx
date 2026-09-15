"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Pencil, Sparkles, Trash2 } from "lucide-react";
import { adminAuthHeaders, handleAdminUnauthorized } from "@/lib/admin-auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

type Run = {
  id: number;
  exam_name: string;
  canonical_exam_name?: string | null;
  status: string;
  overall_progress: number;
  current_step?: string | null;
  course_id?: number | null;
  price_cents?: number | null;
  currency?: string | null;
  access_months?: number | null;
  commerce_confirmed?: boolean;
  created_at?: string;
};

function formatCad(cents?: number | null) {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(cents / 100);
}

export default function AiCourseFactoryPage() {
  const router = useRouter();
  const [examName, setExamName] = useState("RCIC Entry-to-Practice Exam");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [settings, setSettings] = useState<{ openai_configured?: boolean; manus_configured?: boolean } | null>(null);
  const [editTarget, setEditTarget] = useState<Run | null>(null);
  const [editExamName, setEditExamName] = useState("");
  const [editCanonical, setEditCanonical] = useState("");
  const [editPriceCad, setEditPriceCad] = useState("");
  const [editAccessMonths, setEditAccessMonths] = useState("3");
  const [editBusy, setEditBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Run | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  async function load() {
    setError(null);
    try {
      const [runsRes, settingsRes] = await Promise.all([
        fetch(`${API}/admin/course-factory`, { headers: adminAuthHeaders() }),
        fetch(`${API}/admin/course-factory/settings`, { headers: adminAuthHeaders() }),
      ]);

      if (runsRes.status === 401 || settingsRes.status === 401) {
        handleAdminUnauthorized(401);
        return;
      }

      const settingsJson = await settingsRes.json().catch(() => ({}));
      if (settingsRes.ok) {
        setSettings(settingsJson.data ?? null);
      }

      const runsJson = await runsRes.json().catch(() => ({}));
      if (runsRes.ok) {
        setRuns(runsJson.data ?? []);
      } else {
        setError(runsJson.message ?? `Could not load runs (HTTP ${runsRes.status})`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load Course Factory.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API}/admin/course-factory`, {
        method: "POST",
        headers: adminAuthHeaders("application/json"),
        body: JSON.stringify({ exam_name: examName }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 401) {
        handleAdminUnauthorized(401);
        return;
      }
      if (!res.ok) {
        setError(json.message ?? `Failed to start generation (HTTP ${res.status})`);
        return;
      }
      router.push(`/admindashboard/ai-course-factory/${json.data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start generation");
    } finally {
      setBusy(false);
    }
  }

  function openEdit(run: Run) {
    setEditTarget(run);
    setEditExamName(run.exam_name);
    setEditCanonical(run.canonical_exam_name || "");
    setEditPriceCad(run.price_cents != null ? (run.price_cents / 100).toFixed(2) : "");
    setEditAccessMonths(String(run.access_months || 3));
    setError(null);
  }

  async function saveEdit() {
    if (!editTarget) return;
    setEditBusy(true);
    setError(null);
    try {
      const priceTrim = editPriceCad.trim();
      const payload: Record<string, unknown> = {
        exam_name: editExamName.trim(),
        canonical_exam_name: editCanonical.trim() || null,
        course_title: editCanonical.trim() || editExamName.trim(),
        access_months: Number(editAccessMonths) || 3,
      };
      if (priceTrim === "") {
        payload.price_cad = null;
        payload.commerce_confirmed = false;
      } else {
        const price = Number(priceTrim);
        if (!Number.isFinite(price) || price < 0) {
          setError("Enter a valid CAD price (e.g. 199.00).");
          setEditBusy(false);
          return;
        }
        payload.price_cad = price;
        payload.commerce_confirmed = price > 0;
      }
      const res = await fetch(`${API}/admin/course-factory/${editTarget.id}`, {
        method: "PUT",
        headers: adminAuthHeaders("application/json"),
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 401) {
        handleAdminUnauthorized(401);
        return;
      }
      if (!res.ok) {
        setError(json.message ?? `Failed to update (HTTP ${res.status})`);
        return;
      }
      setEditTarget(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update run");
    } finally {
      setEditBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API}/admin/course-factory/${deleteTarget.id}`, {
        method: "DELETE",
        headers: adminAuthHeaders(),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 401) {
        handleAdminUnauthorized(401);
        return;
      }
      if (!res.ok) {
        setError(json.message ?? `Failed to delete (HTTP ${res.status})`);
        return;
      }
      setDeleteTarget(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete run");
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Sparkles className="h-7 w-7 text-emerald-700" />
          <h1 className="text-3xl font-semibold tracking-tight">AI Course Factory</h1>
        </div>
        <p className="max-w-2xl text-muted-foreground">
          Enter a Canadian professional exam name. The system researches official sources, builds the full course,
          question bank, and mock exam — then waits for your review before publish.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="rounded-xl border bg-gradient-to-br from-emerald-50/80 to-white p-6 shadow-sm">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="exam">Exam Name</Label>
            <Input
              id="exam"
              value={examName}
              onChange={(e) => setExamName(e.target.value)}
              placeholder="RCIC Entry-to-Practice Exam"
              className="h-12 text-base"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg" onClick={generate} disabled={busy || !examName.trim()}>
              {busy ? "Starting…" : "Generate Complete Course"}
            </Button>
            <div className="text-sm text-muted-foreground">
              OpenAI: {settings?.openai_configured ? "connected" : "missing"} · Manus:{" "}
              {settings?.manus_configured ? "connected" : "missing"}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-medium">Recent generation runs</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Exam</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Price (CAD)</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.canonical_exam_name || r.exam_name}</TableCell>
                <TableCell>
                  <Badge variant="outline">{r.status}</Badge>
                </TableCell>
                <TableCell>{r.overall_progress}%</TableCell>
                <TableCell className="tabular-nums">{formatCad(r.price_cents)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-wrap items-center justify-end gap-1">
                    <Button variant="ghost" onClick={() => router.push(`/admindashboard/ai-course-factory/${r.id}`)}>
                      Open Studio
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!r.course_id}
                      onClick={() => router.push(`/admindashboard/lms?course=${r.course_id}`)}
                    >
                      <Eye className="mr-1 h-3.5 w-3.5" />
                      View
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>
                      <Pencil className="mr-1 h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(r)}
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {runs.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  No runs yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit generation run</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-exam">Exam name</Label>
              <Input
                id="edit-exam"
                value={editExamName}
                onChange={(e) => setEditExamName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-canonical">Display / course title</Label>
              <Input
                id="edit-canonical"
                value={editCanonical}
                onChange={(e) => setEditCanonical(e.target.value)}
                placeholder="Optional — updates LMS course title"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="edit-price">Price (CAD)</Label>
                <Input
                  id="edit-price"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={editPriceCad}
                  onChange={(e) => setEditPriceCad(e.target.value)}
                  placeholder="e.g. 199.00"
                  disabled={!editTarget?.course_id}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-access">Access (months)</Label>
                <Input
                  id="edit-access"
                  type="number"
                  min="1"
                  max="60"
                  value={editAccessMonths}
                  onChange={(e) => setEditAccessMonths(e.target.value)}
                  disabled={!editTarget?.course_id}
                />
              </div>
            </div>
            {!editTarget?.course_id && (
              <p className="text-xs text-muted-foreground">Price can be set after a course draft is created for this run.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)} disabled={editBusy}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={editBusy || !editExamName.trim()}>
              {editBusy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && !deleteBusy && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete “{deleteTarget?.canonical_exam_name || deleteTarget?.exam_name}”?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the generation run
              {deleteTarget?.course_id ? ", its LMS course, modules, lessons, quizzes, and question bank" : ""}.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteBusy}
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
            >
              {deleteBusy ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
