"use client";

import { use, useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft, Loader2, AlertCircle, Check, CheckCircle2, XCircle,
  Clock, RefreshCw, MessageSquare, FileText, Eye, Send,
  Bot, ShieldCheck, ShieldAlert, ShieldQuestion,
  ChevronDown, FormInput, Briefcase, RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CASE_WORKFLOW_STEPS } from "../workspace-flow-ui";
import { WorkspaceSubpageHero } from "../workspace-subpage-hero";
import { ConsultantInteractiveFormsPanel } from "./consultant-interactive-forms-panel";
import {
  CaseHubProgressHeader, CaseHubOverview, CaseHubLocked,
  DocumentRequirementsGrid, IrccFormsList,
  type HubProgress, type HubRequirement, type HubIrccForm, type HubPackage,
} from "@/components/case-management-hub-ui";
import { ConsultantDocumentPreviewCard } from "@/components/consultant-document-preview-card";
import { PdfViewerDialog } from "@/components/pdf-viewer-dialog";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

// ── Types ──────────────────────────────────────────────────────────────────────

interface DocumentSubmission {
  id: number;
  document_type: string;
  document_label: string;
  original_filename: string;
  file_url: string;
  mime_type: string | null;
  file_size: number | null;
  status: string;
  ai_confidence: number | null;
  ai_result: Record<string, unknown> | null;
  ai_match_result: { matched: boolean; reason: string; details?: Record<string, unknown> } | null;
  rejection_comment: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  uploaded_at: string | null;
}

interface CaseMessage {
  id: number;
  sender_name: string;
  sender_type: "consultant" | "client";
  message: string;
  document_submission_id: number | null;
  read_at: string | null;
  created_at: string;
}

interface ClientData {
  user: { id: number; name: string; email: string };
}

interface CaseFile {
  status: string;
  immigration_pathway: string | null;
  application_forms_verified_at?: string | null;
}

const PIPELINE_STATUSES = [
  { value: "AGREEMENT_SIGNED",      label: "Retainer Signed" },
  { value: "DOCUMENTS_UPLOADING",   label: "Documents Uploading" },
  { value: "UNDER_REVIEW",          label: "Under Review" },
  { value: "READY_FOR_SUBMISSION",  label: "Ready for Submission" },
  { value: "APPLICATION_SUBMITTED", label: "Application Submitted" },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("wtc_consultant_token") : null;
  return {
    "Content-Type": "application/json",
    "Accept": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function pdfAuthHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("wtc_consultant_token") : null;
  return {
    Accept: "application/pdf,*/*",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function isImageFile(doc: { mime_type: string | null; original_filename: string }) {
  if (doc.mime_type?.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|gif)$/i.test(doc.original_filename);
}

function isPdfFile(doc: { mime_type: string | null; original_filename: string }) {
  if (doc.mime_type === "application/pdf") return true;
  return doc.original_filename.toLowerCase().endsWith(".pdf");
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ── Status badge ───────────────────────────────────────────────────────────────

const DOC_STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending_review:       { label: "Pending Review",   color: "bg-amber-50 text-amber-700 border-amber-200",  icon: <Clock className="h-3 w-3" /> },
  under_ai_review:      { label: "AI Scanning…",     color: "bg-blue-50 text-blue-700 border-blue-200",     icon: <Bot className="h-3 w-3 animate-pulse" /> },
  ai_verified:          { label: "AI Verified ✓",    color: "bg-green-50 text-green-700 border-green-200",  icon: <ShieldCheck className="h-3 w-3" /> },
  ai_flagged:           { label: "AI Flagged ⚠",     color: "bg-orange-50 text-orange-700 border-orange-200", icon: <ShieldAlert className="h-3 w-3" /> },
  consultant_approved:  { label: "Approved ✓",       color: "bg-green-50 text-green-700 border-green-200",  icon: <CheckCircle2 className="h-3 w-3" /> },
  consultant_rejected:  { label: "Re-upload requested", color: "bg-red-50 text-red-700 border-red-200",        icon: <XCircle className="h-3 w-3" /> },
};

function DocStatusBadge({ status }: { status: string }) {
  const cfg = DOC_STATUS_CONFIG[status] ?? { label: status, color: "bg-gray-100 text-gray-700 border-gray-200", icon: <ShieldQuestion className="h-3 w-3" /> };
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs border rounded-full px-2 py-0.5 font-medium", cfg.color)}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

// ── Image preview modal ────────────────────────────────────────────────────────

function ImagePreviewDialog({
  open,
  onOpenChange,
  title,
  streamUrl,
  getAuthHeaders,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  streamUrl: string;
  getAuthHeaders: () => Record<string, string>;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !streamUrl) {
      setBlobUrl(null);
      setError(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(streamUrl, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error("Failed to load image.");
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load image.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setBlobUrl(null);
    };
  }, [open, streamUrl, getAuthHeaders]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4",
        !open && "hidden",
      )}
      onClick={() => onOpenChange(false)}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold">{title}</h3>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Close</Button>
        </div>
        <div className="relative flex min-h-[50vh] items-center justify-center bg-muted/20 p-4">
          {loading && <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />}
          {error && !loading && <p className="text-sm text-red-600">{error}</p>}
          {blobUrl && !loading && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={blobUrl} alt={title} className="max-h-[70vh] max-w-full rounded-lg object-contain" />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Review modal ───────────────────────────────────────────────────────────────

function ReviewModal({
  doc,
  onClose,
  onDone,
  profileId,
  onViewDocument,
}: {
  doc: DocumentSubmission;
  onClose: () => void;
  onDone: (updated: DocumentSubmission) => void;
  profileId: string;
  onViewDocument: (doc: DocumentSubmission) => void;
}) {
  const [action, setAction] = useState<"approve" | "request_reupload">("approve");
  const [comment, setComment] = useState(doc.rejection_comment ?? "");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (action === "request_reupload" && !comment.trim()) {
      setErr("Please tell the client what to upload instead.");
      return;
    }
    setLoading(true);
    setErr("");
    const token = localStorage.getItem("wtc_consultant_token");
    const res = await fetch(`${API}/consultant/clients/${profileId}/documents/${doc.id}/review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "Accept": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({
        action: action === "approve" ? "approve" : "reject",
        rejection_comment: action === "request_reupload" ? comment.trim() : null,
      }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) { setErr(json.message ?? "Failed."); return; }
    onDone(json.document);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border bg-background p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <h3 className="mb-1 text-lg font-semibold">Manage document</h3>
        <p className="mb-1 text-sm text-muted-foreground">{doc.document_label}</p>
        <p className="mb-4 text-xs text-muted-foreground">{doc.original_filename}</p>

        <div className="mb-4">
          <DocStatusBadge status={doc.status} />
        </div>

        {doc.ai_match_result && (
          <div className={cn(
            "mb-4 rounded-lg border px-4 py-3 text-sm",
            doc.ai_match_result.matched ? "border-green-200 bg-green-50 text-green-800" : "border-orange-200 bg-orange-50 text-orange-800",
          )}>
            <p className="mb-1 font-medium">{doc.ai_match_result.matched ? "AI: All fields matched ✓" : "AI: Fields mismatch ⚠"}</p>
            <p className="text-xs">{doc.ai_match_result.reason}</p>
            {doc.ai_confidence != null && (
              <p className="mt-1 text-xs">Confidence: {(doc.ai_confidence * 100).toFixed(0)}%</p>
            )}
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mb-4 gap-1.5"
          onClick={() => onViewDocument(doc)}
        >
          <Eye className="h-4 w-4" /> View uploaded file
        </Button>

        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Consultant action</p>
        <div className="mb-3 flex gap-2">
          <button
            onClick={() => setAction("approve")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium transition-colors",
              action === "approve" ? "border-green-600 bg-green-600 text-white" : "border-input hover:bg-muted/50",
            )}
          >
            <Check className="h-4 w-4" /> Approve
          </button>
          <button
            onClick={() => setAction("request_reupload")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium transition-colors",
              action === "request_reupload" ? "border-red-600 bg-red-600 text-white" : "border-input hover:bg-muted/50",
            )}
          >
            <RotateCcw className="h-4 w-4" /> Request re-upload
          </button>
        </div>

        {action === "request_reupload" && (
          <div className="mb-3 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Tell the client what is wrong and what to upload
            </label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Example: This is a bank statement, not a passport. Please upload a clear scan of your passport bio page."
              className="h-24 w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        )}

        {action === "approve" && doc.status === "consultant_rejected" && (
          <p className="mb-3 rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-xs text-green-800">
            Approving will mark this upload as accepted. The client does not need to upload again.
          </p>
        )}

        {err && <p className="mb-3 text-sm text-red-600">{err}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {action === "approve" ? "Save — Approve document" : "Save — Request re-upload"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function CaseManagementClient({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) {
  const { id } = use(paramsPromise);

  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [client, setClient]         = useState<ClientData | null>(null);
  const [caseFile, setCaseFile]     = useState<CaseFile | null>(null);
  const [caseManagementUnlocked, setCaseManagementUnlocked] = useState(false);
  const [hubProgress, setHubProgress] = useState<HubProgress | null>(null);
  const [requirements, setRequirements] = useState<HubRequirement[]>([]);
  const [irccForms, setIrccForms] = useState<HubIrccForm[]>([]);
  const [hubPackage, setHubPackage] = useState<HubPackage | null>(null);
  const [documents, setDocuments]   = useState<DocumentSubmission[]>([]);
  const [messages, setMessages]     = useState<CaseMessage[]>([]);
  const [activeTab, setActiveTab]   = useState<"overview" | "documents" | "forms" | "messages">("overview");
  const [reviewDoc, setReviewDoc]   = useState<DocumentSubmission | null>(null);
  const [msgInput, setMsgInput]     = useState("");
  const [sending, setSending]       = useState(false);
  const [toast, setToast]           = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [pdfViewer, setPdfViewer] = useState<{ title: string; streamUrl: string } | null>(null);
  const [imagePreview, setImagePreview] = useState<{ title: string; streamUrl: string } | null>(null);
  const [togglingCheckId, setTogglingCheckId] = useState<string | null>(null);
  const [checklistData, setChecklistData] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const submissionStreamUrl = (submissionId: number) => `${API}/consultant/clients/${id}/documents/${submissionId}/stream`;
  const packageDocStreamUrl = (documentId: number) => `${API}/consultant/clients/${id}/package-documents/${documentId}/stream`;

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const openPdf = (title: string, streamUrl: string) => setPdfViewer({ title, streamUrl });

  const openDocument = useCallback((
    title: string,
    streamUrl: string,
    mimeType?: string | null,
    filename?: string,
  ) => {
    const fileLike = {
      mime_type: mimeType ?? null,
      original_filename: filename ?? title,
    };
    if (isPdfFile(fileLike)) {
      openPdf(title, streamUrl);
      return;
    }
    if (isImageFile(fileLike)) {
      setImagePreview({ title, streamUrl });
      return;
    }
    fetch(streamUrl, { headers: pdfAuthHeaders() })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank", "noopener,noreferrer");
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      })
      .catch(() => {
        setToast({ msg: "Could not open file.", type: "error" });
        setTimeout(() => setToast(null), 3500);
      });
  }, [id]);

  const openSubmissionDocument = useCallback((doc: DocumentSubmission) => {
    openDocument(doc.document_label, submissionStreamUrl(doc.id), doc.mime_type, doc.original_filename);
  }, [openDocument, id]);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const token = localStorage.getItem("wtc_consultant_token");
    const headers = { "Accept": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };

    try {
      const [hubRes, msgsRes] = await Promise.all([
        fetch(`${API}/consultant/clients/${id}/case-management-hub`, { headers }),
        fetch(`${API}/consultant/clients/${id}/messages`, { headers }),
      ]);

      const [hubJson, msgsJson] = await Promise.all([hubRes.json(), msgsRes.json()]);

      if (!hubRes.ok) throw new Error(hubJson.message ?? "Failed to load client.");
      setClient(hubJson.client);
      setCaseFile(hubJson.case_file);
      setCaseManagementUnlocked(Boolean(hubJson.case_management_unlocked));
      setHubProgress(hubJson.progress ?? null);
      setRequirements(hubJson.document_requirements ?? []);
      setChecklistData(
        Object.fromEntries(
          (hubJson.document_requirements ?? []).map((r: HubRequirement) => [r.id, r.checked]),
        ),
      );
      setIrccForms(hubJson.ircc_forms ?? []);
      setHubPackage(hubJson.application_package ?? null);
      setDocuments(hubJson.documents ?? []);
      setMessages(msgsJson.messages ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const loadMessages = useCallback(async () => {
    const token = localStorage.getItem("wtc_consultant_token");
    const headers = { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    try {
      const res = await fetch(`${API}/consultant/clients/${id}/messages`, { headers });
      if (!res.ok) return;
      const json = await res.json();
      setMessages(json.messages ?? []);
    } catch {
      // silent poll failure
    }
  }, [id]);

  const markMessagesRead = useCallback(async () => {
    const token = localStorage.getItem("wtc_consultant_token");
    const headers = { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    try {
      await fetch(`${API}/consultant/clients/${id}/messages/mark-read`, {
        method: "PATCH",
        headers,
      });
      const now = new Date().toISOString();
      setMessages((prev) =>
        prev.map((m) =>
          m.sender_type === "client" && !m.read_at ? { ...m, read_at: now } : m,
        ),
      );
    } catch {
      // ignore
    }
  }, [id]);

  useEffect(() => {
    if (activeTab === "messages") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, activeTab]);

  useEffect(() => {
    if (activeTab !== "messages") return;
    void markMessagesRead();
    const interval = setInterval(() => void loadMessages(), 30000);
    return () => clearInterval(interval);
  }, [activeTab, markMessagesRead, loadMessages]);

  const sendMessage = async () => {
    if (!msgInput.trim()) return;
    setSending(true);
    const token = localStorage.getItem("wtc_consultant_token");
    try {
      const res = await fetch(`${API}/consultant/clients/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ message: msgInput.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to send.");
      setMessages(prev => [...prev, json.message]);
      setMsgInput("");
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Failed to send.", "error");
    } finally {
      setSending(false);
    }
  };

  const toggleChecklist = async (docId: string, checked: boolean) => {
    const next = { ...checklistData, [docId]: checked };
    setTogglingCheckId(docId);
    setChecklistData(next);
    setRequirements((prev) => prev.map((r) => (r.id === docId ? { ...r, checked } : r)));
    try {
      const res = await fetch(`${API}/consultant/clients/${id}/case-file/checklist`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ checklist_data: next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to update checklist.");
    } catch (e: unknown) {
      setChecklistData((prev) => ({ ...prev, [docId]: !checked }));
      setRequirements((prev) => prev.map((r) => (r.id === docId ? { ...r, checked: !checked } : r)));
      showToast(e instanceof Error ? e.message : "Checklist update failed.", "error");
    } finally {
      setTogglingCheckId(null);
    }
  };

  const updatePipelineStatus = async (newStatus: string) => {
    setUpdatingStatus(true); setStatusMenuOpen(false);
    const token = localStorage.getItem("wtc_consultant_token");
    try {
      const res = await fetch(`${API}/consultant/clients/${id}/case-pipeline`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Accept": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed.");
      setCaseFile(prev => prev ? { ...prev, status: newStatus } : prev);
      showToast("Pipeline status updated.");
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Failed.", "error");
    } finally {
      setUpdatingStatus(false);
    }
  };

  // ── Loading / Error states ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-40">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-40 text-center gap-4">
        <AlertCircle className="h-10 w-10 text-red-400" />
        <p className="text-lg font-semibold">{error}</p>
        <Button variant="outline" asChild>
          <Link href={`/dashboard/clients/${id}/workspace`}><ArrowLeft className="mr-2 h-4 w-4" />Back to Workspace</Link>
        </Button>
      </div>
    );
  }

  if (!caseManagementUnlocked) {
    return (
      <CaseHubLocked
        title="Verify Application Forms First"
        message="Full Case Management unlocks after you review and mark all client application forms as reviewed in the workspace."
        backHref={`/dashboard/clients/${id}/workspace`}
      />
    );
  }

  const pipelineOptions = PIPELINE_STATUSES.map((s) => ({ value: s.value, label: s.label }));
  const currentStatusLabel = hubProgress?.pipeline?.label ?? PIPELINE_STATUSES.find(s => s.value === caseFile?.status)?.label ?? caseFile?.status ?? "—";

  const pendingDocs = documents.filter(d => ["pending_review", "under_ai_review", "ai_flagged"].includes(d.status));
  const unreadCount = messages.filter(m => m.sender_type === "client" && !m.read_at).length;

  const nextActions = [
    ...(pendingDocs.length > 0 ? [{ label: `Review ${pendingDocs.length} uploaded document(s)`, tab: "documents", urgent: true }] : []),
    ...(requirements.filter(r => r.status === "missing").length > 0
      ? [{ label: `Client still needs ${requirements.filter(r => r.status === "missing").length} document(s)`, tab: "documents" }] : []),
    ...(hubProgress && hubProgress.forms.total > 0 && !hubProgress.forms.complete
      ? [{ label: "Review application forms", tab: "forms", urgent: true }] : []),
    ...(unreadCount > 0 ? [{ label: `${unreadCount} unread client message(s)`, tab: "messages" }] : []),
  ];

  return (
    <div className="min-w-0 w-full overflow-x-hidden px-3 py-4 sm:px-4 sm:py-6">
      {/* Toast */}
      {toast && (
        <div className={cn(
          "fixed top-4 right-3 left-3 z-50 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg sm:left-auto sm:max-w-sm",
          toast.type === "success" ? "bg-white border-green-200 text-green-800" : "bg-white border-red-200 text-red-700"
        )}>
          {toast.type === "success" ? <Check className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          {toast.msg}
        </div>
      )}

      <WorkspaceSubpageHero
        profileId={id}
        stepLabel="Step 4 · Case hub"
        title="Full case management"
        description="Manage documents, IRCC forms, pipeline updates, and client communication in one place."
        illustration={CASE_WORKFLOW_STEPS[3].illustration}
        illustrationAlt={CASE_WORKFLOW_STEPS[3].illustrationAlt}
        backLabel="Back to case workspace"
        className="mb-5 sm:mb-6"
      >
        {client?.user.name && (
          <Badge variant="outline" className="h-8 rounded-xl px-3 text-xs">
            {client.user.name}
          </Badge>
        )}
        {caseFile?.immigration_pathway && (
          <Badge variant="outline" className="h-8 rounded-xl px-3 text-xs">
            {caseFile.immigration_pathway}
          </Badge>
        )}
        <div className="relative">
          <button
            onClick={() => setStatusMenuOpen(o => !o)}
            disabled={updatingStatus}
            className="flex h-8 items-center gap-2 rounded-xl border bg-background px-3 text-xs font-medium transition-colors hover:bg-muted/50"
          >
            {updatingStatus ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Pipeline: <span className="text-primary">{currentStatusLabel}</span>
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {statusMenuOpen && (
            <div className="absolute left-0 top-full z-20 mt-1 min-w-[200px] rounded-lg border bg-background py-1 shadow-lg">
              {pipelineOptions.map((s: { value: string; label: string }) => (
                <button
                  key={s.value}
                  onClick={() => updatePipelineStatus(s.value)}
                  className={cn(
                    "w-full px-4 py-2 text-left text-sm transition-colors hover:bg-muted/50",
                    caseFile?.status === s.value && "bg-primary/5 font-semibold text-primary",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <Button variant="outline" size="icon" className="h-8 w-8 rounded-xl" onClick={load}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </WorkspaceSubpageHero>

      {hubProgress && (
        <CaseHubProgressHeader
          progress={hubProgress}
          pathway={caseFile?.immigration_pathway ?? null}
          packageLabel={hubPackage?.label}
          pipelineLabel={currentStatusLabel}
        />
      )}

      {/* Tabs */}
      <div className="mb-4 flex border-b overflow-x-auto sm:mb-6 [-ms-overflow-style:none] [scrollbar-width:thin]">
        <button
          onClick={() => setActiveTab("overview")}
          className={cn(
            "shrink-0 px-3 py-2 text-sm font-medium border-b-2 transition-colors sm:px-4",
            activeTab === "overview" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Briefcase className="inline h-4 w-4 mr-1.5" />
          Overview
        </button>
        <button
          onClick={() => setActiveTab("documents")}
          className={cn(
            "shrink-0 px-3 py-2 text-sm font-medium border-b-2 transition-colors sm:px-4",
            activeTab === "documents" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <FileText className="inline h-4 w-4 mr-1.5" />
          Documents
          {pendingDocs.length > 0 && (
            <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
              {pendingDocs.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("forms")}
          className={cn(
            "shrink-0 px-3 py-2 text-sm font-medium border-b-2 transition-colors sm:px-4",
            activeTab === "forms" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <FormInput className="inline h-4 w-4 mr-1.5" />
          Application Forms
        </button>
        <button
          onClick={() => setActiveTab("messages")}
          className={cn(
            "shrink-0 px-3 py-2 text-sm font-medium border-b-2 transition-colors sm:px-4",
            activeTab === "messages" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <MessageSquare className="inline h-4 w-4 mr-1.5" />
          Messages
          {unreadCount > 0 && (
            <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === "overview" && hubProgress && (
        <CaseHubOverview
          progress={hubProgress}
          pathway={caseFile?.immigration_pathway ?? null}
          package={hubPackage}
          irccForms={irccForms}
          requirements={requirements}
          nextActions={nextActions}
          onViewPdf={openPdf}
          buildPackageDocStreamUrl={packageDocStreamUrl}
          onActionClick={(tab) => setActiveTab(tab as typeof activeTab)}
        />
      )}

      {/* ── DOCUMENTS TAB ── */}
      {activeTab === "documents" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
            Review each upload, approve when correct, or request a re-upload if the client uploaded the wrong file.
            The client will see your note and can upload again from their portal.
          </div>

          <div>
            <p className="mb-3 text-sm font-semibold">Document Requirements</p>
            <DocumentRequirementsGrid
              requirements={requirements}
              consultantView
              allDocuments={documents}
              getAuthHeaders={pdfAuthHeaders}
              renderStatusBadge={(status) => <DocStatusBadge status={status} />}
              onToggleCheck={toggleChecklist}
              togglingCheckId={togglingCheckId}
              onReview={(submissionId) => {
                let doc = documents.find((d) => d.id === submissionId);
                if (!doc) {
                  const req = requirements.find((r) => r.submission?.id === submissionId);
                  if (req?.submission) {
                    doc = {
                      id: req.submission.id,
                      document_type: req.id,
                      document_label: req.label,
                      original_filename: req.submission.original_filename ?? "",
                      file_url: req.submission.file_url,
                      mime_type: req.submission.mime_type ?? null,
                      file_size: null,
                      status: req.submission.status,
                      ai_confidence: null,
                      ai_match_result: null,
                      ai_result: null,
                      rejection_comment: req.submission.rejection_comment ?? null,
                      reviewed_by: null,
                      reviewed_at: null,
                      uploaded_at: req.submission.uploaded_at ?? null,
                    };
                  }
                }
                if (doc) setReviewDoc(doc);
              }}
              onViewDocument={openDocument}
              buildSubmissionStreamUrl={submissionStreamUrl}
            />
          </div>

          {documents.length > 0 && (
            <div>
              <p className="text-sm font-semibold mb-3">All Uploads</p>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {documents.map((doc) => (
                  <ConsultantDocumentPreviewCard
                    key={doc.id}
                    doc={doc}
                    streamUrl={submissionStreamUrl(doc.id)}
                    getAuthHeaders={pdfAuthHeaders}
                    statusBadge={<DocStatusBadge status={doc.status} />}
                    onView={() => openSubmissionDocument(doc)}
                    onManage={() => setReviewDoc(doc)}
                  />
                ))}
              </div>
            </div>
          )}

          {documents.length === 0 && requirements.every((r) => r.status === "missing") && (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-3 border rounded-xl bg-muted/20">
              <FileText className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
              <p className="text-xs text-muted-foreground">The client uploads from their portal under My Documents.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === "forms" && (
        <ConsultantInteractiveFormsPanel profileId={id} onVerificationChange={() => void load()} />
      )}

      {/* ── MESSAGES TAB ── */}
      {activeTab === "messages" && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border bg-muted/10 p-4 h-[400px] overflow-y-auto flex flex-col gap-3">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                <MessageSquare className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No messages yet. Start the conversation!</p>
              </div>
            ) : (
              messages.map(msg => (
                <div key={msg.id} className={cn("flex", msg.sender_type === "consultant" ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm",
                    msg.sender_type === "consultant"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-background border rounded-bl-sm"
                  )}>
                    {msg.sender_type === "client" && (
                      <p className="text-xs font-medium mb-0.5 text-muted-foreground">{msg.sender_name}</p>
                    )}
                    <p className="whitespace-pre-wrap">{msg.message}</p>
                    <p className={cn("text-[10px] mt-1 text-right", msg.sender_type === "consultant" ? "text-primary-foreground/60" : "text-muted-foreground")}>
                      {fmtDate(msg.created_at)}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message input */}
          <div className="flex gap-2">
            <textarea
              value={msgInput}
              onChange={e => setMsgInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Type a message… (Enter to send)"
              className="flex-1 rounded-xl border bg-background px-4 py-2.5 text-sm resize-none h-12 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <Button onClick={sendMessage} disabled={sending || !msgInput.trim()} className="shrink-0">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {reviewDoc && (
        <ReviewModal
          doc={reviewDoc}
          profileId={id}
          onClose={() => setReviewDoc(null)}
          onViewDocument={openSubmissionDocument}
          onDone={async (updated) => {
            setDocuments(prev => prev.map(d => d.id === updated.id ? updated : d));
            setReviewDoc(null);
            showToast(
              updated.status === "consultant_rejected"
                ? "Re-upload requested. Client has been notified."
                : "Document approved.",
            );
            await load();
          }}
        />
      )}
      <ImagePreviewDialog
        open={imagePreview !== null}
        onOpenChange={(open) => { if (!open) setImagePreview(null); }}
        title={imagePreview?.title ?? "Document"}
        streamUrl={imagePreview?.streamUrl ?? ""}
        getAuthHeaders={pdfAuthHeaders}
      />
      <PdfViewerDialog
        open={pdfViewer !== null}
        onOpenChange={(open) => { if (!open) setPdfViewer(null); }}
        title={pdfViewer?.title ?? "Document"}
        streamUrl={pdfViewer?.streamUrl ?? ""}
        getAuthHeaders={pdfAuthHeaders}
      />
    </div>
  );
}
