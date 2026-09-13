"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Loader2, AlertCircle, Check, FileText, MessageSquare,
  CheckCircle2, XCircle, Clock, Eye, RefreshCw, ShieldQuestion,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PdfViewerDialog } from "@/components/pdf-viewer-dialog";
import { PackagePdfFormDialog } from "@/components/package-pdf-form-dialog";
import { cn } from "@/lib/utils";
import { ClientJourneyPageChrome } from "@/components/client-workspace-ui";
import { useClientJourneyOptional } from "@/context/client-journey-context";
import { useClientUnreadMessages } from "@/hooks/use-client-unread-messages";
import Link from "next/link";
import { CLIENT_API, clientAuthHeaders, clientUploadHeaders, clientStreamHeaders } from "@/lib/client-api";
import {
  CaseHubProgressHeader,
  CaseManagementLockedPanel,
  ClientHubNextActions,
  type HubProgress,
  type HubRequirement,
} from "@/components/client-case-hub-ui";
import { CaseDocumentUploadCard } from "./case-document-upload-card";
import { PackageDocumentCard } from "./package-document-card";
import { packageDocumentStreamUrl } from "@/lib/package-document-urls";
import { documentWhyHint } from "@/lib/document-why-hint";

// ── Types ──────────────────────────────────────────────────────────────────────

interface DocumentRequirement {
  id: string;
  label: string;
  category: string;
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
  pending_review:       { label: "Waiting on consultant", color: "bg-amber-50 text-amber-700 border-amber-200",    icon: <Clock className="h-3 w-3" /> },
  under_ai_review:      { label: "Checking…",             color: "bg-blue-50 text-blue-700 border-blue-200",       icon: <Clock className="h-3 w-3 animate-pulse" /> },
  ai_verified:          { label: "Passed initial check",  color: "bg-green-50 text-green-700 border-green-200",    icon: <CheckCircle2 className="h-3 w-3" /> },
  ai_flagged:           { label: "Needs consultant review", color: "bg-orange-50 text-orange-700 border-orange-200", icon: <AlertCircle className="h-3 w-3" /> },
  consultant_approved:  { label: "Approved",              color: "bg-green-50 text-green-700 border-green-200",    icon: <CheckCircle2 className="h-3 w-3" /> },
  consultant_rejected:  { label: "Re-upload needed",      color: "bg-red-50 text-red-700 border-red-200",       icon: <XCircle className="h-3 w-3" /> },
};

function DocStatusBadge({ status }: { status: string }) {
  const cfg = DOC_STATUS_CONFIG[status] ?? { label: status, color: "bg-gray-100 text-gray-700 border-gray-200", icon: <ShieldQuestion className="h-3 w-3" /> };
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs border rounded-full px-2 py-0.5 font-medium", cfg.color)}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

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
  const [documents, setDocuments] = useState<DocumentSubmission[]>([]);
  const [applicationPackage, setApplicationPackage] = useState<ApplicationPackage | null>(null);
  const [toast, setToast]         = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [pdfViewer, setPdfViewer] = useState<{ title: string; streamUrl: string } | null>(null);
  const [imagePreview, setImagePreview] = useState<{ title: string; streamUrl: string } | null>(null);
  const [packageForm, setPackageForm] = useState<{
    documentId: number;
    title: string;
    streamUrl: string;
    alreadySubmitted: boolean;
  } | null>(null);
  const pdfAuthHeaders = useCallback(() => clientStreamHeaders(), []);
  const journey = useClientJourneyOptional();
  const pendingFormRequests = journey?.qStats.pendingRefills ?? 0;
  const { count: unreadMessages } = useClientUnreadMessages(true);

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

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError("");
    setLocked(false);
    try {
      const hubRes = await fetch(`${CLIENT_API}/client/case-management-hub`, { headers: clientAuthHeaders() });
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

      const cf = hubJson.case_file;
      setPathway(cf?.immigration_pathway ?? null);
      setApplicationPackage(hubJson.application_package ?? null);
      setHubProgress(hubJson.progress ?? null);
      setHubRequirements(hubJson.document_requirements ?? []);
      setDocuments(hubJson.documents ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const uploadDocument = async (
    docType: string,
    docLabel: string,
    file: File,
    options?: { silent?: boolean; skipReload?: boolean },
  ): Promise<boolean> => {
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
      setDocuments(prev => [json.document, ...prev]);
      setHubRequirements((prev) =>
        prev.map((r) =>
          r.id === docType
            ? { ...r, status: "pending", submission: json.document }
            : r,
        ),
      );
      if (!options?.silent) {
        showToast("Document uploaded successfully.");
      }
      if (!options?.skipReload) {
        await load(true);
      }
      return true;
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Upload failed.", "error");
      return false;
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

  const requiredDocs: DocumentRequirement[] = hubRequirements.map((r) => ({
    id: r.id,
    label: r.label,
    category: r.category,
  }));
  const submissionsByType = documents.reduce<Record<string, DocumentSubmission[]>>((acc, d) => {
    (acc[d.document_type] ??= []).push(d);
    return acc;
  }, {});
  const approvedCount = documents.filter(d => ["consultant_approved", "ai_verified"].includes(d.status)).length;
  const rejectedCount = documents.filter(d => d.status === "consultant_rejected").length;
  const pendingCount  = documents.filter(d => ["pending_review", "under_ai_review", "ai_flagged"].includes(d.status)).length;
  const missingDocs   = hubRequirements.filter((r) => r.status === "missing" || r.status === "rejected").length;
  const allRequiredApproved =
    requiredDocs.length > 0 &&
    requiredDocs.every((doc) => {
      const existing = submissionsByType[doc.id] ?? [];
      return existing.some((s) => ["consultant_approved", "ai_verified"].includes(s.status));
    });

  const nextActions: { label: string; tab: string; urgent?: boolean }[] = [];
  if (pendingFormRequests > 0) {
    nextActions.push({
      label: `Update ${pendingFormRequests} questionnaire correction${pendingFormRequests === 1 ? "" : "s"}`,
      tab: "profile",
      urgent: true,
    });
  }
  if (rejectedCount > 0) {
    nextActions.push({
      label: `Re-upload ${rejectedCount} rejected document${rejectedCount === 1 ? "" : "s"}`,
      tab: "documents",
      urgent: true,
    });
  }
  if (missingDocs > 0) {
    nextActions.push({
      label: `Upload ${missingDocs} missing document${missingDocs === 1 ? "" : "s"}`,
      tab: "documents",
      urgent: true,
    });
  }
  if (pendingCount > 0 && rejectedCount === 0 && missingDocs === 0) {
    nextActions.push({
      label: `${pendingCount} document${pendingCount === 1 ? "" : "s"} waiting on consultant review`,
      tab: "documents",
    });
  }
  if (allRequiredApproved) {
    nextActions.push({
      label: "Documents look complete — your consultant will share filing next steps",
      tab: "documents",
    });
  }
  if (unreadMessages > 0) {
    nextActions.push({
      label: `Read ${unreadMessages} new message${unreadMessages === 1 ? "" : "s"} from your consultant`,
      tab: "messages",
      urgent: true,
    });
  }

  const onNextAction = (tab: string) => {
    if (tab === "profile") {
      window.location.href = "/user-dashboard/questionnaire";
      return;
    }
    if (tab === "messages") {
      window.location.href = "/user-dashboard/messages";
      return;
    }
    document.getElementById("document-checklist")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <ClientJourneyPageChrome
      stepId="documents"
      description={`Upload the documents needed for your ${pathway ?? "immigration"} application. Your consultant reviews them and shares next steps.`}
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

      <div className="mb-6">
        <ClientHubNextActions actions={nextActions} onActionClick={onNextAction} />
      </div>

      {pendingFormRequests > 0 && (
        <div className="mb-6 flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Your consultant needs answers for official forms. Open{" "}
            <span className="font-medium">Your profile</span> to update highlighted fields.
          </p>
          <Button asChild size="sm" variant="outline" className="shrink-0 border-amber-300 bg-white">
            <Link href="/user-dashboard/questionnaire">Open Your profile</Link>
          </Button>
        </div>
      )}

      <p className="mb-4 text-xs text-muted-foreground">
        After you upload: <span className="font-medium text-foreground">Uploaded</span>
        {" → "}
        <span className="font-medium text-foreground">Consultant review</span>
        {" → "}
        <span className="font-medium text-foreground">Ready for filing</span>
      </p>

      <div className="mb-6 flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <MessageSquare className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-semibold">Message your consultant</p>
            <p className="text-xs text-muted-foreground">
              Questions about a document? Use Messages — separate from this upload checklist.
            </p>
          </div>
        </div>
        <Button asChild size="sm" variant="outline" className="shrink-0">
          <Link href="/user-dashboard/messages">
            Open Messages
            {unreadMessages > 0 && (
              <span className="ml-1.5 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-primary px-1.5 py-px text-[10px] font-bold text-primary-foreground">
                {unreadMessages > 9 ? "9+" : unreadMessages}
              </span>
            )}
          </Link>
        </Button>
      </div>

      {allRequiredApproved && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-950">
          <p className="font-semibold">Document checklist complete</p>
          <p className="mt-0.5 text-xs text-emerald-800">
            Required uploads are approved. Your consultant will confirm when the file is ready to submit to IRCC.
          </p>
        </div>
      )}

      <div id="document-checklist" className="space-y-3">
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
            <div className="mb-4 space-y-3 rounded-xl border border-border bg-muted/20 p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your application package</p>
                <p className="mt-1 text-lg font-bold">{applicationPackage.label}</p>
              </div>
              {applicationPackage.result && (
                <details className="rounded-lg border bg-background px-3 py-2 text-sm">
                  <summary className="cursor-pointer font-medium text-muted-foreground">
                    IRCC guide / checklist references
                  </summary>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground">Guide</p>
                      <p className="font-medium">{applicationPackage.result.guide}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground">Checklist</p>
                      <p className="font-medium">{applicationPackage.result.checklist}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground">Forms</p>
                      <p className="font-medium">{applicationPackage.result.forms.join(", ")}</p>
                    </div>
                  </div>
                </details>
              )}
              {applicationPackage.documents.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium">Files from your consultant</p>
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {applicationPackage.documents.map((doc) => {
                      const isSubmitted = Boolean(doc.submission?.submitted_at);
                      const streamUrl = packageDocumentStreamUrl(doc.id, isSubmitted);
                      return (
                      <PackageDocumentCard
                        key={doc.id}
                        doc={doc}
                        streamUrl={streamUrl}
                        onOpen={() =>
                          setPackageForm({
                            documentId: doc.id,
                            title: doc.label,
                            streamUrl,
                            alreadySubmitted: isSubmitted,
                          })
                        }
                      />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {requiredDocs.length === 0 ? (
            <div className="rounded-xl border border-dashed px-4 py-10 text-center">
              <p className="text-sm font-medium">No document checklist yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Your consultant will assign required documents for your pathway. Check Messages if you are waiting on instructions.
              </p>
              <Button asChild size="sm" variant="outline" className="mt-4">
                <Link href="/user-dashboard/messages">Open Messages</Link>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {requiredDocs.map((doc) => {
                const existing = submissionsByType[doc.id] ?? [];
                const latest = existing[0];
                return (
                  <CaseDocumentUploadCard
                    key={doc.id}
                    docId={doc.id}
                    label={doc.label}
                    category={doc.category}
                    description={documentWhyHint(doc.id, doc.category, doc.label)}
                    submissions={existing}
                    statusBadge={latest ? <DocStatusBadge status={latest.status} /> : undefined}
                    onUpload={uploadDocument}
                    onViewDocument={openDocument}
                    onReload={() => load(true)}
                  />
                );
              })}
            </div>
          )}

          {documents.filter(d => !requiredDocs.find(r => r.id === d.document_type)).map(doc => (
            <div key={doc.id} className="rounded-xl border p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
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

      {packageForm && (
        <PackagePdfFormDialog
          open
          onOpenChange={(open) => { if (!open) setPackageForm(null); }}
          documentId={packageForm.documentId}
          title={packageForm.title}
          streamUrl={packageForm.streamUrl}
          alreadySubmitted={packageForm.alreadySubmitted}
          getAuthHeaders={pdfAuthHeaders}
          onSubmitted={() => {
            showToast("Form submitted to your consultant.");
            void load(true);
          }}
        />
      )}

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
