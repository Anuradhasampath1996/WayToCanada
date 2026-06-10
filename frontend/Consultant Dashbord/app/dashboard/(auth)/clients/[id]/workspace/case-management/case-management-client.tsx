"use client";

import { use, useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft, Loader2, AlertCircle, Check, CheckCircle2, XCircle,
  Clock, RefreshCw, MessageSquare, FileText, Eye, Send,
  Bot, ShieldCheck, ShieldAlert, ShieldQuestion, MoreHorizontal,
  ChevronDown, FormInput, Briefcase,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { WorkspaceBreadcrumb } from "../workspace-flow-ui";
import { ConsultantInteractiveFormsPanel } from "./consultant-interactive-forms-panel";
import {
  CaseHubProgressHeader, CaseHubOverview, CaseHubLocked,
  DocumentRequirementsGrid, IrccFormsList,
  type HubProgress, type HubRequirement, type HubIrccForm, type HubPackage,
} from "@/components/case-management-hub-ui";
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

function isPdfFile(doc: { mime_type: string | null; original_filename: string }) {
  if (doc.mime_type === "application/pdf") return true;
  return doc.original_filename.toLowerCase().endsWith(".pdf");
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

// ── Status badge ───────────────────────────────────────────────────────────────

const DOC_STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending_review:       { label: "Pending Review",   color: "bg-amber-50 text-amber-700 border-amber-200",  icon: <Clock className="h-3 w-3" /> },
  under_ai_review:      { label: "AI Scanning…",     color: "bg-blue-50 text-blue-700 border-blue-200",     icon: <Bot className="h-3 w-3 animate-pulse" /> },
  ai_verified:          { label: "AI Verified ✓",    color: "bg-green-50 text-green-700 border-green-200",  icon: <ShieldCheck className="h-3 w-3" /> },
  ai_flagged:           { label: "AI Flagged ⚠",     color: "bg-orange-50 text-orange-700 border-orange-200", icon: <ShieldAlert className="h-3 w-3" /> },
  consultant_approved:  { label: "Approved ✓",       color: "bg-green-50 text-green-700 border-green-200",  icon: <CheckCircle2 className="h-3 w-3" /> },
  consultant_rejected:  { label: "Rejected",         color: "bg-red-50 text-red-700 border-red-200",        icon: <XCircle className="h-3 w-3" /> },
};

function DocStatusBadge({ status }: { status: string }) {
  const cfg = DOC_STATUS_CONFIG[status] ?? { label: status, color: "bg-gray-100 text-gray-700 border-gray-200", icon: <ShieldQuestion className="h-3 w-3" /> };
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs border rounded-full px-2 py-0.5 font-medium", cfg.color)}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

// ── Review modal ───────────────────────────────────────────────────────────────

function ReviewModal({
  doc,
  onClose,
  onDone,
  profileId,
  onViewPdf,
}: {
  doc: DocumentSubmission;
  onClose: () => void;
  onDone: (updated: DocumentSubmission) => void;
  profileId: string;
  onViewPdf: (title: string, streamUrl: string) => void;
}) {
  const [action, setAction] = useState<"approve" | "reject">("approve");
  const [comment, setComment] = useState(doc.rejection_comment ?? "");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (action === "reject" && !comment.trim()) { setErr("Please provide a rejection reason."); return; }
    setLoading(true); setErr("");
    const token = localStorage.getItem("wtc_consultant_token");
    const res = await fetch(`${API}/consultant/clients/${profileId}/documents/${doc.id}/review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "Accept": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ action, rejection_comment: comment }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) { setErr(json.message ?? "Failed."); return; }
    onDone(json.document);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-background rounded-xl border shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <h3 className="font-semibold text-lg mb-1">Review Document</h3>
        <p className="text-sm text-muted-foreground mb-4">{doc.document_label}</p>

        {/* AI result */}
        {doc.ai_match_result && (
          <div className={cn(
            "rounded-lg border px-4 py-3 mb-4 text-sm",
            doc.ai_match_result.matched ? "bg-green-50 border-green-200 text-green-800" : "bg-orange-50 border-orange-200 text-orange-800"
          )}>
            <p className="font-medium mb-1">{doc.ai_match_result.matched ? "AI: All fields matched ✓" : "AI: Fields mismatch ⚠"}</p>
            <p className="text-xs">{doc.ai_match_result.reason}</p>
            {doc.ai_confidence != null && (
              <p className="text-xs mt-1">Confidence: {(doc.ai_confidence * 100).toFixed(0)}%</p>
            )}
          </div>
        )}

        {/* View file */}
        {isPdfFile(doc) ? (
          <button
            type="button"
            onClick={() => onViewPdf(doc.document_label, `${API}/consultant/clients/${profileId}/documents/${doc.id}/stream`)}
            className="flex items-center gap-2 text-sm text-primary hover:underline mb-4"
          >
            <Eye className="h-4 w-4" /> View uploaded PDF
          </button>
        ) : (
          <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-primary hover:underline mb-4">
            <Eye className="h-4 w-4" /> View uploaded file ↗
          </a>
        )}

        {/* Action picker */}
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setAction("approve")}
            className={cn("flex-1 flex items-center justify-center gap-2 rounded-lg border py-2 text-sm font-medium transition-colors",
              action === "approve" ? "bg-green-600 text-white border-green-600" : "border-input hover:bg-muted/50")}
          >
            <Check className="h-4 w-4" /> Approve
          </button>
          <button
            onClick={() => setAction("reject")}
            className={cn("flex-1 flex items-center justify-center gap-2 rounded-lg border py-2 text-sm font-medium transition-colors",
              action === "reject" ? "bg-red-600 text-white border-red-600" : "border-input hover:bg-muted/50")}
          >
            <XCircle className="h-4 w-4" /> Reject
          </button>
        </div>

        {action === "reject" && (
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Reason for rejection (visible to client)…"
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm resize-none h-20 mb-3 focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        )}

        {err && <p className="text-sm text-red-600 mb-3">{err}</p>}

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {action === "approve" ? "Approve Document" : "Reject & Notify Client"}
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
  const [togglingCheckId, setTogglingCheckId] = useState<string | null>(null);
  const [checklistData, setChecklistData] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const openPdf = (title: string, streamUrl: string) => setPdfViewer({ title, streamUrl });
  const submissionStreamUrl = (submissionId: number) => `${API}/consultant/clients/${id}/documents/${submissionId}/stream`;
  const packageDocStreamUrl = (documentId: number) => `${API}/consultant/clients/${id}/package-documents/${documentId}/stream`;

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

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

  useEffect(() => {
    if (activeTab === "messages") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, activeTab]);

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
    <div className="w-full px-4 py-6 pb-16">
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

      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild className="-ml-2 rounded-lg">
          <Link href={`/dashboard/clients/${id}/workspace`}>
            <ArrowLeft className="mr-1.5 size-4" />
            Back to case workspace
          </Link>
        </Button>
      </div>

      <WorkspaceBreadcrumb profileId={id} workspaceStep={4} pageLabel="Case management" />

      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Full Case Management</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {client?.user.name} &mdash; {client?.user.email} &middot; {caseFile?.immigration_pathway ?? "No pathway"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Pipeline status dropdown */}
          <div className="relative">
            <button
              onClick={() => setStatusMenuOpen(o => !o)}
              disabled={updatingStatus}
              className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-muted/50 transition-colors"
            >
              {updatingStatus ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Pipeline: <span className="text-primary">{currentStatusLabel}</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {statusMenuOpen && (
              <div className="absolute right-0 top-full mt-1 z-20 bg-background border rounded-lg shadow-lg min-w-[200px] py-1">
                {pipelineOptions.map((s: { value: string; label: string }) => (
                  <button
                    key={s.value}
                    onClick={() => updatePipelineStatus(s.value)}
                    className={cn(
                      "w-full text-left px-4 py-2 text-sm hover:bg-muted/50 transition-colors",
                      caseFile?.status === s.value && "font-semibold text-primary bg-primary/5"
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Button variant="ghost" size="icon" onClick={load}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {hubProgress && (
        <CaseHubProgressHeader
          progress={hubProgress}
          pathway={caseFile?.immigration_pathway ?? null}
          packageLabel={hubPackage?.label}
          pipelineLabel={currentStatusLabel}
        />
      )}

      {/* Tabs */}
      <div className="flex border-b mb-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab("overview")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors shrink-0",
            activeTab === "overview" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Briefcase className="inline h-4 w-4 mr-1.5" />
          Overview
        </button>
        <button
          onClick={() => setActiveTab("documents")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
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
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
            activeTab === "forms" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <FormInput className="inline h-4 w-4 mr-1.5" />
          Application Forms
        </button>
        <button
          onClick={() => setActiveTab("messages")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
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
          <div>
            <p className="text-sm font-semibold mb-3">Document Requirements</p>
            <DocumentRequirementsGrid
              requirements={requirements}
              consultantView
              onToggleCheck={toggleChecklist}
              togglingCheckId={togglingCheckId}
              onReview={(submissionId) => {
                const doc = documents.find((d) => d.id === submissionId);
                if (doc) setReviewDoc(doc);
              }}
              onViewPdf={openPdf}
              buildSubmissionStreamUrl={submissionStreamUrl}
            />
          </div>

          {documents.length > 0 && (
            <div>
              <p className="text-sm font-semibold mb-3">All Uploads</p>
              <div className="space-y-3">
                {documents.map(doc => (
              <div key={doc.id} className={cn(
                "rounded-xl border p-4 transition-colors",
                doc.status === "consultant_approved" && "border-green-200 bg-green-50/30",
                doc.status === "consultant_rejected" && "border-red-200 bg-red-50/30",
                doc.status === "ai_flagged" && "border-orange-200 bg-orange-50/30",
              )}>
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <p className="text-sm font-medium">{doc.document_label}</p>
                        <p className="text-xs text-muted-foreground">{doc.original_filename} {doc.file_size ? `· ${fmtSize(doc.file_size)}` : ""}</p>
                      </div>
                      <DocStatusBadge status={doc.status} />
                    </div>

                    {/* AI match result */}
                    {doc.ai_match_result && (
                      <div className={cn(
                        "mt-2 rounded-lg px-3 py-1.5 text-xs",
                        doc.ai_match_result.matched ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"
                      )}>
                        <Bot className="inline h-3 w-3 mr-1" />
                        AI: {doc.ai_match_result.reason}
                        {doc.ai_confidence != null && ` (${(doc.ai_confidence * 100).toFixed(0)}% confidence)`}
                      </div>
                    )}

                    {/* Rejection comment */}
                    {doc.rejection_comment && (
                      <div className="mt-2 rounded-lg bg-red-50 border border-red-100 px-3 py-1.5 text-xs text-red-700">
                        <XCircle className="inline h-3 w-3 mr-1" />
                        {doc.rejection_comment}
                      </div>
                    )}

                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      <span className="text-xs text-muted-foreground">Uploaded {fmtDate(doc.uploaded_at)}</span>
                      {doc.reviewed_by && (
                        <span className="text-xs text-muted-foreground">· Reviewed by {doc.reviewed_by}</span>
                      )}
                      <div className="ml-auto flex gap-2">
                        {isPdfFile(doc) ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => openPdf(doc.document_label, submissionStreamUrl(doc.id))}
                          >
                            <Eye className="h-3 w-3" /> View
                          </Button>
                        ) : (
                          <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                              <Eye className="h-3 w-3" /> View
                            </Button>
                          </a>
                        )}
                        {!["consultant_approved", "consultant_rejected"].includes(doc.status) && (
                          <Button size="sm" className="h-7 text-xs gap-1" onClick={() => setReviewDoc(doc)}>
                            <MoreHorizontal className="h-3 w-3" /> Review
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
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
          onViewPdf={openPdf}
          onDone={async (updated) => {
            setDocuments(prev => prev.map(d => d.id === updated.id ? updated : d));
            setReviewDoc(null);
            showToast("Document review saved.");
            await load();
          }}
        />
      )}
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
