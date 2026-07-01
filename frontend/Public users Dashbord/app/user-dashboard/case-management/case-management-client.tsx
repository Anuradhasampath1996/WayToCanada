"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Loader2, AlertCircle, Check, FileText, Upload, MessageSquare,
  Send, CheckCircle2, XCircle, Clock, Bot, ShieldCheck, ShieldAlert,
  ShieldQuestion, CloudUpload, Eye, RefreshCw, Briefcase,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PdfViewerDialog } from "@/components/pdf-viewer-dialog";
import { PackagePdfFormDialog } from "@/components/package-pdf-form-dialog";
import { cn } from "@/lib/utils";
import { ClientJourneyPageChrome } from "@/components/client-workspace-ui";
import { CLIENT_API, clientAuthHeaders, clientUploadHeaders, clientStreamHeaders } from "@/lib/client-api";
import {
  CaseHubProgressHeader,
  ClientRequirementsStatusGrid,
  IrccFormsList,
  ClientHubNextActions,
  CaseManagementLockedPanel,
  type HubProgress,
  type HubRequirement,
  type HubIrccForm,
} from "@/components/client-case-hub-ui";

// ── Types ──────────────────────────────────────────────────────────────────────

interface DocumentRequirement {
  id: string;
  label: string;
}

interface DocumentSubmission {
  id: number;
  document_type: string;
  document_label: string;
  original_filename: string;
  file_url: string;
  file_size: number | null;
  mime_type: string | null;
  status: string;
  ai_confidence: number | null;
  ai_match_result: { matched: boolean; reason: string } | null;
  rejection_comment: string | null;
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

interface ApplicationPackage {
  id: number;
  label: string;
  breadcrumb: string[];
  result: { guide: string; checklist: string; forms: string[] } | null;
  documents: {
    id: number;
    label: string;
    doc_type: string;
    original_filename: string;
    file_url: string;
    submission?: { id: number; status: string; submitted_at: string | null } | null;
  }[];
}

interface FormsVerification {
  case_management_unlocked?: boolean;
  total_forms?: number;
  submitted_count?: number;
  reviewed_count?: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function isPdfFile(submission: { mime_type: string | null; original_filename: string }) {
  if (submission.mime_type === "application/pdf") return true;
  return submission.original_filename.toLowerCase().endsWith(".pdf");
}

function isImageFile(submission: { mime_type: string | null; original_filename: string }) {
  if (submission.mime_type?.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|gif)$/i.test(submission.original_filename);
}

const ALLOWED_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

function validateUploadFile(file: File): string | null {
  if (file.size > MAX_UPLOAD_BYTES) {
    return "File is too large. Maximum size is 20 MB.";
  }
  const type = file.type || "";
  const name = file.name.toLowerCase();
  const allowed =
    ALLOWED_UPLOAD_TYPES.includes(type) ||
    /\.(jpe?g|png|webp|pdf)$/i.test(name);
  if (!allowed) {
    return "Please upload a JPG, PNG, WEBP, or PDF file.";
  }
  return null;
}

// ── Status badge ───────────────────────────────────────────────────────────────

const DOC_STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending_review:       { label: "Pending Review",   color: "bg-amber-50 text-amber-700 border-amber-200",    icon: <Clock className="h-3 w-3" /> },
  under_ai_review:      { label: "AI Scanning…",     color: "bg-blue-50 text-blue-700 border-blue-200",       icon: <Bot className="h-3 w-3 animate-pulse" /> },
  ai_verified:          { label: "AI Verified ✓",    color: "bg-green-50 text-green-700 border-green-200",    icon: <ShieldCheck className="h-3 w-3" /> },
  ai_flagged:           { label: "Needs Review",     color: "bg-orange-50 text-orange-700 border-orange-200", icon: <ShieldAlert className="h-3 w-3" /> },
  consultant_approved:  { label: "Approved ✓",       color: "bg-green-50 text-green-700 border-green-200",    icon: <CheckCircle2 className="h-3 w-3" /> },
  consultant_rejected:  { label: "Rejected — Reupload", color: "bg-red-50 text-red-700 border-red-200",       icon: <XCircle className="h-3 w-3" /> },
};

function DocStatusBadge({ status }: { status: string }) {
  const cfg = DOC_STATUS_CONFIG[status] ?? { label: status, color: "bg-gray-100 text-gray-700 border-gray-200", icon: <ShieldQuestion className="h-3 w-3" /> };
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs border rounded-full px-2 py-0.5 font-medium", cfg.color)}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

// ── Drop Zone ──────────────────────────────────────────────────────────────────

function DropZone({
  doc,
  existingSubmission,
  onUpload,
  onViewDocument,
}: {
  doc: DocumentRequirement;
  existingSubmission: DocumentSubmission | undefined;
  onUpload: (docType: string, docLabel: string, file: File) => Promise<boolean>;
  onViewDocument: (submission: DocumentSubmission) => void;
}) {
  const [draggingOver, setDraggingOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    const validationError = validateUploadFile(file);
    if (validationError) {
      setUploadError(validationError);
      return;
    }

    setUploadError(null);
    setUploading(true);
    const ok = await onUpload(doc.id, doc.label, file);
    setUploading(false);
    if (!ok) {
      setUploadError("Upload failed. Please try again.");
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDraggingOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const isApproved = existingSubmission?.status === "consultant_approved";
  const isRejected = existingSubmission?.status === "consultant_rejected";
  const canUpload = !isApproved;
  const showDropZone = canUpload;

  return (
    <div className={cn(
      "rounded-xl border-2 p-4 transition-all",
      isApproved && "border-green-200 bg-green-50/30",
      isRejected && "border-red-200 bg-red-50/30",
      !existingSubmission && "border-dashed border-input",
      draggingOver && "border-primary bg-primary/5 scale-[1.01]"
    )}>
      <div className="flex items-start gap-3">
        <div className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full shrink-0 mt-0.5",
          isApproved ? "bg-green-100 text-green-600" : isRejected ? "bg-red-100 text-red-600" : "bg-muted text-muted-foreground"
        )}>
          {isApproved ? <CheckCircle2 className="h-4 w-4" /> : isRejected ? <XCircle className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{doc.label}</p>

          {existingSubmission && (
            <div className="mt-1.5 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <DocStatusBadge status={existingSubmission.status} />
                <span className="text-xs text-muted-foreground">{existingSubmission.original_filename} {existingSubmission.file_size ? `· ${fmtSize(existingSubmission.file_size)}` : ""}</span>
              </div>

              {existingSubmission.ai_match_result && (
                <p className={cn("text-xs", existingSubmission.ai_match_result.matched ? "text-green-700" : "text-orange-700")}>
                  <Bot className="inline h-3 w-3 mr-0.5" />
                  {existingSubmission.ai_match_result.reason}
                </p>
              )}

              {isRejected && existingSubmission.rejection_comment && (
                <div className="mt-1 rounded-lg border border-red-100 bg-red-50 px-3 py-1.5 text-xs text-red-700">
                  <XCircle className="mr-1 inline h-3 w-3" />
                  <strong>Consultant note:</strong> {existingSubmission.rejection_comment}
                </div>
              )}

              {isRejected && (
                <p className="text-xs font-medium text-red-700">
                  Please upload the correct file below.
                </p>
              )}
            </div>
          )}

          {showDropZone && (
            <div
              onDragOver={e => { e.preventDefault(); setDraggingOver(true); }}
              onDragLeave={() => setDraggingOver(false)}
              onDrop={onDrop}
              onClick={() => !uploading && inputRef.current?.click()}
              className={cn(
                "mt-2 flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed py-4 cursor-pointer transition-colors hover:bg-muted/30",
                draggingOver && "border-primary bg-primary/5",
                uploading && "opacity-60 pointer-events-none"
              )}
            >
              {uploading ? (
                <><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /><p className="text-xs text-muted-foreground">Uploading…</p></>
              ) : (
                <>
                  <CloudUpload className="h-5 w-5 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">
                    {isRejected ? "Upload corrected file" : existingSubmission ? "Replace file" : "Drag & drop or click to upload"}
                  </p>
                  <p className="text-[10px] text-muted-foreground/70">JPG, PNG, PDF, WEBP · max 20 MB</p>
                </>
              )}
            </div>
          )}

          {uploadError && (
            <p className="mt-2 text-xs text-red-600">{uploadError}</p>
          )}

          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
          />

          {existingSubmission && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() => onViewDocument(existingSubmission)}
              >
                <Eye className="h-3 w-3" /> View
              </Button>
              {canUpload && !isRejected && (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="text-xs text-primary hover:underline"
                >
                  Replace file
                </button>
              )}
              {isApproved && (
                <span className="text-[11px] text-green-700">Approved by your consultant</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Image preview ──────────────────────────────────────────────────────────────

function ImagePreviewDialog({
  open,
  onOpenChange,
  title,
  streamUrl,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  streamUrl: string;
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
        const res = await fetch(streamUrl, { headers: clientStreamHeaders() });
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
  }, [open, streamUrl]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => onOpenChange(false)}>
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border bg-background shadow-xl" onClick={(e) => e.stopPropagation()}>
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

// ── Main Component ─────────────────────────────────────────────────────────────

export function CaseManagementClient() {
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [locked, setLocked]       = useState(false);
  const [lockedMessage, setLockedMessage] = useState("");
  const [lockedVerification, setLockedVerification] = useState<FormsVerification | null>(null);
  const [error, setError]         = useState("");
  const [pathway, setPathway]     = useState<string | null>(null);
  const [hubRequirements, setHubRequirements] = useState<HubRequirement[]>([]);
  const [hubProgress, setHubProgress] = useState<HubProgress | null>(null);
  const [irccForms, setIrccForms] = useState<HubIrccForm[]>([]);
  const [documents, setDocuments] = useState<DocumentSubmission[]>([]);
  const [applicationPackage, setApplicationPackage] = useState<ApplicationPackage | null>(null);
  const [messages, setMessages]   = useState<CaseMessage[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "documents" | "messages">("overview");
  const [msgInput, setMsgInput]   = useState("");
  const [sending, setSending]     = useState(false);
  const [toast, setToast]         = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [pdfViewer, setPdfViewer] = useState<{ title: string; streamUrl: string } | null>(null);
  const [imagePreview, setImagePreview] = useState<{ title: string; streamUrl: string } | null>(null);
  const [packageForm, setPackageForm] = useState<{
    documentId: number;
    title: string;
    streamUrl: string;
    alreadySubmitted: boolean;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pdfAuthHeaders = useCallback(() => clientStreamHeaders(), []);

  const submissionStreamUrl = (submissionId: number) =>
    `${CLIENT_API}/client/documents/${submissionId}/stream`;

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const openDocument = useCallback((submission: DocumentSubmission) => {
    const title = submission.document_label || submission.original_filename;
    const streamUrl = submissionStreamUrl(submission.id);
    if (isPdfFile(submission)) {
      setPdfViewer({ title, streamUrl });
      return;
    }
    if (isImageFile(submission)) {
      setImagePreview({ title, streamUrl });
      return;
    }
    fetch(streamUrl, { headers: clientStreamHeaders() })
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
  }, []);

  const loadMessages = useCallback(async () => {
    try {
      const res = await fetch(`${CLIENT_API}/client/messages`, { headers: clientAuthHeaders() });
      if (!res.ok) return;
      const json = await res.json();
      setMessages(json.messages ?? []);
    } catch {
      // silent poll failure
    }
  }, []);

  const markMessagesRead = useCallback(async () => {
    try {
      await fetch(`${CLIENT_API}/client/messages/mark-read`, {
        method: "PATCH",
        headers: clientAuthHeaders(),
      });
      const now = new Date().toISOString();
      setMessages((prev) =>
        prev.map((m) =>
          m.sender_type === "consultant" && !m.read_at ? { ...m, read_at: now } : m,
        ),
      );
    } catch {
      // ignore
    }
  }, []);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError("");
    setLocked(false);
    try {
      const [hubRes, msgsRes] = await Promise.all([
        fetch(`${CLIENT_API}/client/case-management-hub`, { headers: clientAuthHeaders() }),
        fetch(`${CLIENT_API}/client/messages`, { headers: clientAuthHeaders() }),
      ]);
      const hubJson = await hubRes.json();

      if (hubRes.status === 403) {
        setLocked(true);
        setLockedMessage(hubJson.message ?? "Complete application forms before uploading documents.");
        setLockedVerification(hubJson.verification ?? null);
        setPathway(hubJson.case_file?.immigration_pathway ?? null);
        return;
      }

      if (!hubRes.ok) {
        throw new Error(hubJson.message ?? "Failed to load.");
      }

      const msgsJson = msgsRes.ok ? await msgsRes.json() : { messages: [] };

      const cf = hubJson.case_file;
      setPathway(cf?.immigration_pathway ?? null);
      setApplicationPackage(hubJson.application_package ?? null);
      setHubProgress(hubJson.progress ?? null);
      setHubRequirements(hubJson.document_requirements ?? []);
      setIrccForms(hubJson.ircc_forms ?? []);
      setDocuments(hubJson.documents ?? []);
      setMessages(msgsJson.messages ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (activeTab === "messages") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, activeTab]);

  useEffect(() => {
    if (locked || activeTab !== "messages") return;
    void markMessagesRead();
    const interval = setInterval(loadMessages, 30000);
    return () => clearInterval(interval);
  }, [locked, activeTab, loadMessages, markMessagesRead]);

  const uploadDocument = async (docType: string, docLabel: string, file: File): Promise<boolean> => {
    const validationError = validateUploadFile(file);
    if (validationError) {
      showToast(validationError, "error");
      return false;
    }

    const form = new FormData();
    form.append("document_type", docType);
    form.append("document_label", docLabel);
    form.append("file", file);

    try {
      const res = await fetch(`${CLIENT_API}/client/documents/upload`, {
        method: "POST",
        headers: clientUploadHeaders(),
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Upload failed.");
      setDocuments(prev => {
        const existing = prev.findIndex(d => d.document_type === docType);
        if (existing >= 0) {
          const copy = [...prev];
          copy[existing] = json.document;
          return copy;
        }
        return [json.document, ...prev];
      });
      setHubRequirements((prev) =>
        prev.map((r) =>
          r.id === docType
            ? { ...r, status: "pending", submission: json.document }
            : r,
        ),
      );
      showToast("Document uploaded successfully.");
      await load(true);
      return true;
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Upload failed.", "error");
      return false;
    }
  };

  const sendMessage = async () => {
    if (!msgInput.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`${CLIENT_API}/client/messages`, {
        method: "POST",
        headers: clientAuthHeaders(true),
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-40">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (locked) {
    return (
      <ClientJourneyPageChrome
        stepId="documents"
        description="Complete your application forms to unlock document uploads."
      >
        <CaseManagementLockedPanel message={lockedMessage} verification={lockedVerification} />
      </ClientJourneyPageChrome>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-4 text-center">
        <AlertCircle className="h-10 w-10 text-red-400" />
        <p className="text-lg font-semibold">{error}</p>
        <Button variant="outline" onClick={() => load()}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button>
      </div>
    );
  }

  const requiredDocs: DocumentRequirement[] = hubRequirements.map((r) => ({ id: r.id, label: r.label }));
  const submissionMap = Object.fromEntries(documents.map(d => [d.document_type, d]));
  const approvedCount = documents.filter(d => ["consultant_approved", "ai_verified"].includes(d.status)).length;
  const rejectedCount = documents.filter(d => d.status === "consultant_rejected").length;
  const pendingCount  = documents.filter(d => ["pending_review", "under_ai_review", "ai_flagged"].includes(d.status)).length;
  const unreadCount   = messages.filter(m => m.sender_type === "consultant" && !m.read_at).length;
  const missingDocs   = hubRequirements.filter((r) => r.status === "missing" || r.status === "rejected").length;

  const clientNextActions = [
    ...(missingDocs > 0 ? [{ label: `Upload ${missingDocs} required document(s)`, tab: "documents" as const, urgent: true }] : []),
    ...(pendingCount > 0 ? [{ label: `${pendingCount} document(s) awaiting consultant review`, tab: "documents" as const }] : []),
    ...(rejectedCount > 0 ? [{ label: `${rejectedCount} document(s) need re-upload`, tab: "documents" as const, urgent: true }] : []),
    ...(unreadCount > 0 ? [{ label: `${unreadCount} new message(s) from consultant`, tab: "messages" as const }] : []),
  ];

  return (
    <ClientJourneyPageChrome
      stepId="documents"
      description={`Upload required documents and message your consultant for your ${pathway ?? "immigration"} application.`}
      extra={
        <div className="flex w-full flex-wrap items-center gap-2">
          {hubProgress && (
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              {hubProgress.overall_percent}% complete
            </div>
          )}
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => load(true)} disabled={refreshing}>
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1", refreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      }
    >
      {toast && (
        <div className={cn(
          "fixed left-3 right-3 top-4 z-50 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg sm:left-auto sm:right-4 sm:max-w-sm",
          toast.type === "success" ? "bg-white border-green-200 text-green-800" : "bg-white border-red-200 text-red-700"
        )}>
          {toast.type === "success" ? <Check className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          {toast.msg}
        </div>
      )}

      {hubProgress && (
        <CaseHubProgressHeader
          progress={hubProgress}
          pathway={pathway}
          packageLabel={applicationPackage?.label}
          pipelineLabel={hubProgress.pipeline.label}
        />
      )}

      <div className="flex items-start gap-3 rounded-xl border bg-blue-50 border-blue-200 p-4 mb-6 text-sm text-blue-800">
        <Bot className="h-5 w-5 shrink-0 mt-0.5 text-blue-600" />
        <div>
          <p className="font-medium">AI-Powered Document Verification</p>
          <p className="text-xs mt-0.5 text-blue-700">
            After uploading, our AI system automatically scans and verifies your documents.
            Image files are auto-scanned against your questionnaire data. PDF uploads are reviewed manually by your consultant.
          </p>
        </div>
      </div>

      <div className="-mx-3 mb-6 flex border-b overflow-x-auto px-3 sm:mx-0 sm:px-0">
        <button
          onClick={() => setActiveTab("overview")}
          className={cn(
            "px-3 py-2 text-sm font-medium border-b-2 transition-colors shrink-0 sm:px-4",
            activeTab === "overview" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Briefcase className="inline h-4 w-4 mr-1.5" />
          Overview
        </button>
        <button
          onClick={() => setActiveTab("documents")}
          className={cn(
            "px-3 py-2 text-sm font-medium border-b-2 transition-colors shrink-0 sm:px-4",
            activeTab === "documents" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Upload className="inline h-4 w-4 mr-1.5" />
          Documents ({approvedCount} / {requiredDocs.length})
        </button>
        <button
          onClick={() => setActiveTab("messages")}
          className={cn(
            "px-3 py-2 text-sm font-medium border-b-2 transition-colors shrink-0 sm:px-4",
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

      {activeTab === "overview" && (
        <div className="space-y-6">
          <ClientHubNextActions actions={clientNextActions} onActionClick={(tab) => setActiveTab(tab as typeof activeTab)} />

          {applicationPackage && (
            <div className="rounded-xl border p-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your application package</p>
              <p className="font-semibold">{applicationPackage.label}</p>
              <p className="text-sm text-muted-foreground">{applicationPackage.breadcrumb.join(" › ")}</p>
            </div>
          )}

          <div className="rounded-xl border p-4 space-y-3">
            <p className="text-sm font-semibold">Document checklist</p>
            {hubRequirements.length > 0 ? (
              <ClientRequirementsStatusGrid requirements={hubRequirements} />
            ) : (
              <p className="text-sm text-muted-foreground italic">No document requirements configured yet.</p>
            )}
          </div>

          <div className="rounded-xl border p-4 space-y-3">
            <p className="text-sm font-semibold">IRCC forms for your pathway</p>
            <IrccFormsList forms={irccForms} pathway={pathway} />
          </div>
        </div>
      )}

      {activeTab === "documents" && (
        <div className="space-y-3">
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border bg-card p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Approved</p>
              <p className="text-xl font-bold text-green-700">{approvedCount}<span className="text-sm font-normal text-muted-foreground">/{requiredDocs.length}</span></p>
            </div>
            <div className="rounded-xl border bg-card p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Awaiting review</p>
              <p className="text-xl font-bold text-amber-700">{pendingCount}</p>
            </div>
            <div className="rounded-xl border bg-card p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Need re-upload</p>
              <p className="text-xl font-bold text-red-700">{rejectedCount}</p>
            </div>
          </div>

          {(missingDocs > 0 || rejectedCount > 0) && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {rejectedCount > 0
                ? `${rejectedCount} document(s) need a corrected upload. Read your consultant's note, then upload again.`
                : `${missingDocs} required document(s) still need to be uploaded.`}
            </div>
          )}
          {applicationPackage && (
            <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4 space-y-3 mb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">Assigned Application Package</p>
                <p className="text-lg font-bold mt-1">{applicationPackage.label}</p>
                <p className="text-xs text-muted-foreground">{applicationPackage.breadcrumb.join(" › ")}</p>
              </div>
              {applicationPackage.result && (
                <div className="grid gap-2 sm:grid-cols-3 text-sm">
                  <div className="rounded-lg border bg-white p-3">
                    <p className="text-[10px] uppercase text-muted-foreground">Guide</p>
                    <p className="font-medium">{applicationPackage.result.guide}</p>
                  </div>
                  <div className="rounded-lg border bg-white p-3">
                    <p className="text-[10px] uppercase text-muted-foreground">Checklist</p>
                    <p className="font-medium">{applicationPackage.result.checklist}</p>
                  </div>
                  <div className="rounded-lg border bg-white p-3">
                    <p className="text-[10px] uppercase text-muted-foreground">Forms</p>
                    <p className="font-medium">{applicationPackage.result.forms.join(", ")}</p>
                  </div>
                </div>
              )}
              {applicationPackage.documents.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Documents from your consultant</p>
                  {applicationPackage.documents.map(doc => (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => setPackageForm({
                        documentId: doc.id,
                        title: doc.label,
                        streamUrl: `${CLIENT_API}/client/package-documents/${doc.id}/stream`,
                        alreadySubmitted: !!doc.submission?.submitted_at,
                      })}
                      className="w-full flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm hover:bg-muted/40 text-left"
                    >
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <span className="font-medium flex-1">{doc.label}</span>
                      {doc.submission?.submitted_at ? (
                        <Badge className="bg-green-600 text-[10px] shrink-0">Submitted</Badge>
                      ) : doc.doc_type === "form" ? (
                        <Badge variant="secondary" className="text-[10px] shrink-0">Fill & submit</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] shrink-0">{doc.doc_type}</Badge>
                      )}
                      <Eye className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {requiredDocs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No document requirements from your consultant yet.
            </p>
          ) : (
            requiredDocs.map(doc => (
              <DropZone
                key={doc.id}
                doc={doc}
                existingSubmission={submissionMap[doc.id]}
                onUpload={uploadDocument}
                onViewDocument={openDocument}
              />
            ))
          )}

          {documents.filter(d => !requiredDocs.find(r => r.id === d.document_type)).map(doc => (
            <div key={doc.id} className="rounded-xl border p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{doc.document_label}</p>
                  <p className="text-xs text-muted-foreground">{doc.original_filename}</p>
                </div>
                <DocStatusBadge status={doc.status} />
              </div>
              {doc.rejection_comment && (
                <div className="mt-2 rounded-lg border border-red-100 bg-red-50 px-3 py-1.5 text-xs text-red-700">
                  <XCircle className="mr-1 inline h-3 w-3" />{doc.rejection_comment}
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                className="mt-2 h-7 gap-1 text-xs"
                onClick={() => openDocument(doc)}
              >
                <Eye className="h-3 w-3" /> View file
              </Button>
            </div>
          ))}
        </div>
      )}

      {activeTab === "messages" && (
        <div className="flex flex-col gap-4">
          <div className="flex min-h-[50vh] max-h-[60vh] flex-col gap-3 overflow-y-auto rounded-xl border bg-muted/10 p-4 sm:h-[400px] sm:max-h-none">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                <MessageSquare className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No messages yet.</p>
                <p className="text-xs text-muted-foreground/70">Your consultant will send you updates and instructions here.</p>
              </div>
            ) : (
              messages.map(msg => (
                <div key={msg.id} className={cn("flex", msg.sender_type === "client" ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm",
                    msg.sender_type === "client"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-background border rounded-bl-sm"
                  )}>
                    {msg.sender_type === "consultant" && (
                      <p className="text-xs font-medium mb-0.5 text-muted-foreground">{msg.sender_name}</p>
                    )}
                    <p className="whitespace-pre-wrap">{msg.message}</p>
                    <p className={cn("text-[10px] mt-1 text-right", msg.sender_type === "client" ? "text-primary-foreground/60" : "text-muted-foreground")}>
                      {fmtDate(msg.created_at)}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="flex gap-2">
            <textarea
              value={msgInput}
              onChange={e => setMsgInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Type a message to your consultant… (Enter to send)"
              className="flex-1 rounded-xl border bg-background px-4 py-2.5 text-sm resize-none h-12 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <Button onClick={sendMessage} disabled={sending || !msgInput.trim()} className="shrink-0">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}

      <PackagePdfFormDialog
        open={packageForm !== null}
        onOpenChange={(open) => { if (!open) setPackageForm(null); }}
        documentId={packageForm?.documentId ?? 0}
        title={packageForm?.title ?? "Form"}
        streamUrl={packageForm?.streamUrl ?? ""}
        alreadySubmitted={packageForm?.alreadySubmitted}
        getAuthHeaders={pdfAuthHeaders}
        onSubmitted={() => {
          showToast("Form submitted to your consultant.");
          load(true);
        }}
      />

      <ImagePreviewDialog
        open={imagePreview !== null}
        onOpenChange={(open) => { if (!open) setImagePreview(null); }}
        title={imagePreview?.title ?? "Document"}
        streamUrl={imagePreview?.streamUrl ?? ""}
      />
      <PdfViewerDialog
        open={pdfViewer !== null}
        onOpenChange={(open) => { if (!open) setPdfViewer(null); }}
        title={pdfViewer?.title ?? "Document"}
        streamUrl={pdfViewer?.streamUrl ?? ""}
        getAuthHeaders={pdfAuthHeaders}
      />
    </ClientJourneyPageChrome>
  );
}
