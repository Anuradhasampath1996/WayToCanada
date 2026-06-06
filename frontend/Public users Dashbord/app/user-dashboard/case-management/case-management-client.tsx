"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  Loader2, AlertCircle, Check, FileText, Upload, MessageSquare,
  Send, CheckCircle2, XCircle, Clock, Bot, ShieldCheck, ShieldAlert,
  ShieldQuestion, CloudUpload, Eye, RefreshCw, ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PdfViewerDialog } from "@/components/pdf-viewer-dialog";
import { cn } from "@/lib/utils";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

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

interface DashboardData {
  case_file: {
    id: number;
    status: string;
    immigration_pathway: string | null;
    agreement_signed_at: string | null;
    application_forms_verified_at?: string | null;
  } | null;
  application_package?: ApplicationPackage | null;
  application_forms_verification?: {
    case_management_unlocked: boolean;
    all_submitted: boolean;
    all_reviewed: boolean;
  } | null;
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
  }[];
}

// ── Pathway Document Requirements ─────────────────────────────────────────────

const BASE_DOCS: DocumentRequirement[] = [
  { id: "passport",      label: "Valid Passport (all pages)" },
  { id: "photos",        label: "Passport-style photos (2x)" },
  { id: "proof_address", label: "Proof of address" },
  { id: "police_cert",   label: "Police clearance certificate" },
  { id: "medical_exam",  label: "Medical examination (IMM 1017E)" },
];

const PATHWAY_DOCS: Record<string, DocumentRequirement[]> = {
  "Express Entry": [
    { id: "ielts_results",         label: "Language test results (IELTS / CELPIP)" },
    { id: "eca",                   label: "Educational Credential Assessment (ECA/WES)" },
    { id: "employment_refs",       label: "Employment reference letters" },
    { id: "pay_stubs",             label: "Pay stubs (last 3 months)" },
    { id: "tax_returns",           label: "NOA / Tax returns" },
    { id: "proof_funds",           label: "Proof of funds (bank statements)" },
    { id: "express_entry_profile", label: "Express Entry profile confirmation" },
  ],
  "PNP": [
    { id: "ielts_results",   label: "Language test results" },
    { id: "eca",             label: "Educational Credential Assessment" },
    { id: "employment_refs", label: "Employment reference letters" },
    { id: "pnp_nomination",  label: "Provincial Nomination Certificate" },
    { id: "job_offer",       label: "Job offer letter (if applicable)" },
    { id: "proof_funds",     label: "Proof of funds" },
  ],
  "Family Sponsorship": [
    { id: "sponsor_status",     label: "Sponsor's PR card / citizenship certificate" },
    { id: "marriage_cert",      label: "Marriage / relationship certificate" },
    { id: "sponsor_income",     label: "Sponsor's proof of income (NOA)" },
    { id: "relationship_proof", label: "Proof of genuine relationship (photos, messages)" },
    { id: "birth_certs",        label: "Birth certificates (dependents)" },
  ],
  "Study Permit": [
    { id: "acceptance_letter", label: "Letter of acceptance from DLI" },
    { id: "ielts_results",     label: "Language test results" },
    { id: "transcripts",       label: "Academic transcripts (O/L & A/L certificates)" },
    { id: "study_plan",        label: "Statement of purpose / study plan" },
    { id: "proof_funds",       label: "Proof of financial support (bank statements)" },
    { id: "sponsor_letter",    label: "Sponsor letter (if applicable)" },
  ],
  "Work Permit": [
    { id: "lmia_job_offer",      label: "LMIA-approved job offer / LMIA-exempt offer" },
    { id: "employment_contract", label: "Signed employment contract" },
    { id: "ielts_results",       label: "Language test results (if required)" },
    { id: "qualifications",      label: "Educational / professional qualifications" },
    { id: "resume",              label: "Current resume / CV" },
  ],
};

function getRequiredDocsFromHub(requirements: { id: string; label: string }[]): DocumentRequirement[] {
  return requirements.map((r) => ({ id: r.id, label: r.label }));
}

function pathwayFamily(pathway: string | null): string | null {
  if (!pathway) return null;
  if (pathway.includes("Express Entry")) return "Express Entry";
  if (pathway.includes("PNP") || pathway.includes("Provincial")) return "PNP";
  if (pathway.includes("Sponsorship")) return "Family Sponsorship";
  if (pathway.includes("Study")) return "Study Permit";
  if (pathway.includes("Work")) return "Work Permit";
  return pathway;
}

function getRequiredDocs(pathway: string | null): DocumentRequirement[] {
  const family = pathwayFamily(pathway);
  const extra = family && PATHWAY_DOCS[family] ? PATHWAY_DOCS[family] : (family && PATHWAY_DOCS[pathway] ? PATHWAY_DOCS[pathway] : []);
  return [...BASE_DOCS, ...extra];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getCookieToken(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)wtc_token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function authHeaders(): Record<string, string> {
  const token = typeof window !== "undefined"
    ? (localStorage.getItem("wtc_token") ?? getCookieToken())
    : null;
  return {
    "Accept": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

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
  onViewPdf,
}: {
  doc: DocumentRequirement;
  existingSubmission: DocumentSubmission | undefined;
  onUpload: (docType: string, docLabel: string, file: File) => Promise<void>;
  onViewPdf: (title: string, streamUrl: string) => void;
}) {
  const [draggingOver, setDraggingOver] = useState(false);
  const [uploading, setUploading]       = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setUploading(true);
    await onUpload(doc.id, doc.label, file);
    setUploading(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDraggingOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const isApproved = existingSubmission?.status === "consultant_approved";
  const isRejected = existingSubmission?.status === "consultant_rejected";
  const hasUpload  = !!existingSubmission && !isRejected;

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
                <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-1.5 text-xs text-red-700 mt-1">
                  <XCircle className="inline h-3 w-3 mr-1" />
                  <strong>Rejection reason:</strong> {existingSubmission.rejection_comment}
                </div>
              )}
            </div>
          )}

          {/* Upload area — show if no approved doc, or if rejected */}
          {(!hasUpload || isRejected) && (
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
                <><CloudUpload className="h-5 w-5 text-muted-foreground" /><p className="text-xs text-muted-foreground">Drag & drop or click to upload</p><p className="text-[10px] text-muted-foreground/70">JPG, PNG, PDF, WEBP · max 20 MB</p></>
              )}
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
          />

          {existingSubmission && !isRejected && (
            <div className="flex items-center gap-2 mt-2">
              {isPdfFile(existingSubmission) ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs gap-1"
                  onClick={() => onViewPdf(
                    existingSubmission.document_label || existingSubmission.original_filename,
                    `${API}/client/documents/${existingSubmission.id}/stream`,
                  )}
                >
                  <Eye className="h-3 w-3" />View
                </Button>
              ) : (
                <a href={existingSubmission.file_url} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="h-6 text-xs gap-1"><Eye className="h-3 w-3" />View</Button>
                </a>
              )}
              {!isApproved && (
                <button
                  onClick={() => inputRef.current?.click()}
                  className="text-xs text-primary hover:underline"
                >
                  Replace file
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function CaseManagementClient() {
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [pathway, setPathway]     = useState<string | null>(null);
  const [caseStatus, setCaseStatus] = useState<string | null>(null);
  const [caseManagementUnlocked, setCaseManagementUnlocked] = useState(false);
  const [hubRequirements, setHubRequirements] = useState<DocumentRequirement[]>([]);
  const [hubProgress, setHubProgress] = useState<{ overall_percent: number; documents: { approved: number; total: number; missing: number } } | null>(null);
  const [documents, setDocuments] = useState<DocumentSubmission[]>([]);
  const [applicationPackage, setApplicationPackage] = useState<ApplicationPackage | null>(null);
  const [messages, setMessages]   = useState<CaseMessage[]>([]);
  const [activeTab, setActiveTab] = useState<"documents" | "messages">("documents");
  const [msgInput, setMsgInput]   = useState("");
  const [sending, setSending]     = useState(false);
  const [toast, setToast]         = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [pdfViewer, setPdfViewer] = useState<{ title: string; streamUrl: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [hubRes, msgsRes] = await Promise.all([
        fetch(`${API}/client/case-management-hub`, { headers: authHeaders() }),
        fetch(`${API}/client/messages`, { headers: authHeaders() }),
      ]);
      const [hubJson, msgsJson] = await Promise.all([hubRes.json(), msgsRes.json()]);
      if (!hubRes.ok) throw new Error(hubJson.message ?? "Failed to load.");

      const cf = hubJson.case_file;
      setPathway(cf?.immigration_pathway ?? null);
      setCaseStatus(cf?.status ?? null);
      setCaseManagementUnlocked(Boolean(hubJson.case_management_unlocked));
      setApplicationPackage(hubJson.application_package ?? null);
      setHubProgress(hubJson.progress ?? null);
      setHubRequirements(getRequiredDocsFromHub(hubJson.document_requirements ?? []));
      setDocuments(hubJson.documents ?? []);
      setMessages(msgsJson.messages ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (activeTab === "messages") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, activeTab]);

  const uploadDocument = async (docType: string, docLabel: string, file: File) => {
    const token = typeof window !== "undefined" ? (localStorage.getItem("wtc_token") ?? getCookieToken()) : null;
    const form = new FormData();
    form.append("document_type", docType);
    form.append("document_label", docLabel);
    form.append("file", file);

    try {
      const res = await fetch(`${API}/client/documents/upload`, {
        method: "POST",
        headers: { "Accept": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
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
      showToast("Document uploaded successfully.");
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Upload failed.", "error");
    }
  };

  const sendMessage = async () => {
    if (!msgInput.trim()) return;
    setSending(true);
    const token = typeof window !== "undefined" ? (localStorage.getItem("wtc_token") ?? getCookieToken()) : null;
    try {
      const res = await fetch(`${API}/client/messages`, {
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

  // ── Loading / Error ────────────────────────────────────────────────────────

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

  // Agreement must be signed
  const agreementSigned = caseStatus && ["AGREEMENT_SIGNED", "DOCUMENTS_UPLOADING", "UNDER_REVIEW", "READY_FOR_SUBMISSION", "APPLICATION_SUBMITTED"].includes(caseStatus);

  if (!agreementSigned) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center max-w-md mx-auto">
        <FileText className="h-12 w-12 text-muted-foreground/40" />
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Step 2 of 4</p>
        <h2 className="text-xl font-bold">Sign your retainer first</h2>
        <p className="text-sm text-muted-foreground">
          Case documents unlock after you sign the retainer agreement and complete application forms.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <Button asChild>
            <Link href="/user-dashboard/retainer-agreement">Go to retainer agreement</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/user-dashboard">Back to home</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!caseManagementUnlocked) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center max-w-md mx-auto">
        <Clock className="h-12 w-12 text-muted-foreground/40" />
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Step 3 of 4</p>
        <h2 className="text-xl font-bold">Almost there — forms under review</h2>
        <p className="text-sm text-muted-foreground">
          Submit all application forms, then wait for your consultant to verify them. Case documents will unlock automatically.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <Button asChild>
            <Link href="/user-dashboard/application-forms">Continue application forms</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/user-dashboard">Back to home</Link>
          </Button>
        </div>
      </div>
    );
  }

  const requiredDocs = hubRequirements.length > 0 ? hubRequirements : getRequiredDocs(pathway);
  const submissionMap = Object.fromEntries(documents.map(d => [d.document_type, d]));
  const approvedCount = documents.filter(d => ["consultant_approved", "ai_verified"].includes(d.status)).length;
  const rejectedCount = documents.filter(d => d.status === "consultant_rejected").length;
  const pendingCount  = documents.filter(d => ["pending_review", "under_ai_review", "ai_flagged"].includes(d.status)).length;
  const unreadCount   = messages.filter(m => m.sender_type === "consultant" && !m.read_at).length;

  return (
    <div className="w-full pb-16">
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
      <div className="mb-6">
        <Button variant="ghost" size="sm" className="h-8 -ml-2 mb-3 text-muted-foreground" asChild>
          <Link href="/user-dashboard">
            <ChevronLeft className="h-4 w-4 mr-0.5" /> Back to home
          </Link>
        </Button>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Step 4 of 4</p>
        <h1 className="text-2xl font-bold tracking-tight">Case documents</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Upload required documents and message your consultant for <strong>{pathway ?? "your"}</strong> application
        </p>
        {hubProgress && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium">
            {hubProgress.overall_percent}% case complete · {hubProgress.documents.approved}/{hubProgress.documents.total} docs approved
          </div>
        )}
      </div>

      {/* Progress stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl border p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{approvedCount}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Approved</p>
        </div>
        <div className={cn("rounded-xl border p-4 text-center", pendingCount > 0 ? "border-amber-200" : "")}>
          <p className={cn("text-2xl font-bold", pendingCount > 0 ? "text-amber-600" : "text-muted-foreground")}>{pendingCount}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Under Review</p>
        </div>
        <div className={cn("rounded-xl border p-4 text-center", rejectedCount > 0 ? "border-red-200" : "")}>
          <p className={cn("text-2xl font-bold", rejectedCount > 0 ? "text-red-600" : "text-muted-foreground")}>{rejectedCount}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Need Reupload</p>
        </div>
      </div>

      {/* AI notice */}
      <div className="flex items-start gap-3 rounded-xl border bg-blue-50 border-blue-200 p-4 mb-6 text-sm text-blue-800">
        <Bot className="h-5 w-5 shrink-0 mt-0.5 text-blue-600" />
        <div>
          <p className="font-medium">AI-Powered Document Verification</p>
          <p className="text-xs mt-0.5 text-blue-700">
            After uploading, our AI system automatically scans and verifies your documents. 
            If everything matches your questionnaire data, the document is auto-approved. 
            Your consultant will be notified only if a review is needed.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-6">
        <button
          onClick={() => setActiveTab("documents")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
            activeTab === "documents" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Upload className="inline h-4 w-4 mr-1.5" />
          Documents ({documents.length} / {requiredDocs.length})
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

      {/* ── DOCUMENTS TAB ── */}
      {activeTab === "documents" && (
        <div className="space-y-3">
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
                      onClick={() => setPdfViewer({
                        title: doc.label,
                        streamUrl: `${API}/client/package-documents/${doc.id}/stream`,
                      })}
                      className="w-full flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm hover:bg-muted/40 text-left"
                    >
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <span className="font-medium flex-1">{doc.label}</span>
                      <Badge variant="outline" className="text-[10px] shrink-0">{doc.doc_type}</Badge>
                      <Eye className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {requiredDocs.map(doc => (
            <DropZone
              key={doc.id}
              doc={doc}
              existingSubmission={submissionMap[doc.id]}
              onUpload={uploadDocument}
              onViewPdf={(title, streamUrl) => setPdfViewer({ title, streamUrl })}
            />
          ))}

          {/* Extra uploads not in required list */}
          {documents.filter(d => !requiredDocs.find(r => r.id === d.document_type)).map(doc => (
            <div key={doc.id} className="rounded-xl border p-4">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{doc.document_label}</p>
                  <p className="text-xs text-muted-foreground">{doc.original_filename}</p>
                </div>
                <DocStatusBadge status={doc.status} />
              </div>
              {doc.rejection_comment && (
                <div className="mt-2 rounded-lg bg-red-50 border border-red-100 px-3 py-1.5 text-xs text-red-700">
                  <XCircle className="inline h-3 w-3 mr-1" />{doc.rejection_comment}
                </div>
              )}
              {isPdfFile(doc) ? (
                <button
                  type="button"
                  onClick={() => setPdfViewer({
                    title: doc.document_label || doc.original_filename,
                    streamUrl: `${API}/client/documents/${doc.id}/stream`,
                  })}
                  className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Eye className="h-3 w-3" />View file
                </button>
              ) : (
                <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                  <Eye className="h-3 w-3" />View file
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── MESSAGES TAB ── */}
      {activeTab === "messages" && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border bg-muted/10 p-4 h-[400px] overflow-y-auto flex flex-col gap-3">
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
      <PdfViewerDialog
        open={pdfViewer !== null}
        onOpenChange={(open) => { if (!open) setPdfViewer(null); }}
        title={pdfViewer?.title ?? "Document"}
        streamUrl={pdfViewer?.streamUrl ?? ""}
        getAuthHeaders={authHeaders}
      />
    </div>
  );
}
