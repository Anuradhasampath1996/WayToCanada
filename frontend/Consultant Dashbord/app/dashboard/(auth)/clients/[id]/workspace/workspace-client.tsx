"use client";

import { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft, Loader2, AlertCircle, Send, CheckCircle2, Clock, Lock,
  ChevronRight, FileText, ClipboardList, Briefcase, UserCheck,
  Check, RefreshCw, FormInput, Eye, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ConsultantInteractiveFormsPanel } from "./case-management/consultant-interactive-forms-panel";
import {
  SignedRetainerAgreementPreview,
  type AgreementData,
} from "@/components/signed-retainer-agreement-preview";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

// ── Types ──────────────────────────────────────────────────────────────────────

const STATUS_ORDER: Record<string, number> = {
  PENDING_ASSESSMENT:   0,
  PATHWAY_SELECTED:     1,
  AGREEMENT_SENT:       2,
  AGREEMENT_SIGNED:     3,
};

const STATUS_LABELS: Record<string, string> = {
  PENDING_ASSESSMENT:   "Pending Assessment",
  PATHWAY_SELECTED:     "Pathway Selected",
  AGREEMENT_SENT:       "Agreement Sent",
  AGREEMENT_SIGNED:     "Agreement Signed",
};

interface CaseFile {
  id: number;
  status: string;
  immigration_pathway: string | null;
  agreement_token: string | null;
  agreement_sent_at: string | null;
  agreement_signed_at: string | null;
  application_forms_verified_at: string | null;
  signed_document_path: string | null;
  client_signature: string | null;
  checklist_data: Record<string, boolean> | null;
}

interface FormsVerification {
  agreement_signed: boolean;
  total_forms: number;
  submitted_count: number;
  reviewed_count: number;
  all_submitted: boolean;
  all_reviewed: boolean;
  verified_at: string | null;
  case_management_unlocked: boolean;
}

interface ClientData {
  id: number;
  user: { id: number; name: string; email: string };
}

// ── Document Checklist Definitions ────────────────────────────────────────────

const BASE_CHECKLIST = [
  { id: "passport",      label: "Valid Passport (all pages)" },
  { id: "photos",        label: "Passport-style photos (2x)" },
  { id: "proof_address", label: "Proof of address" },
  { id: "police_cert",   label: "Police clearance certificate" },
  { id: "medical_exam",  label: "Medical examination (IMM 1017E)" },
];

const PATHWAY_CHECKLIST: Record<string, { id: string; label: string }[]> = {
  "Express Entry": [
    { id: "ielts_results",   label: "Language test results (IELTS / CELPIP)" },
    { id: "eca",             label: "Educational Credential Assessment (ECA)" },
    { id: "employment_refs", label: "Employment reference letters" },
    { id: "pay_stubs",       label: "Pay stubs (last 3 months)" },
    { id: "tax_returns",     label: "NOA / Tax returns" },
    { id: "express_entry_profile", label: "Express Entry profile confirmation" },
  ],
  "PNP": [
    { id: "ielts_results",   label: "Language test results" },
    { id: "eca",             label: "Educational Credential Assessment" },
    { id: "employment_refs", label: "Employment reference letters" },
    { id: "pnp_nomination",  label: "Provincial Nomination Certificate" },
    { id: "job_offer",       label: "Job offer letter (if applicable)" },
  ],
  "Family Sponsorship": [
    { id: "sponsor_status",  label: "Sponsor's PR card / citizenship certificate" },
    { id: "marriage_cert",   label: "Marriage / relationship certificate" },
    { id: "sponsor_income",  label: "Sponsor's proof of income (NOA)" },
    { id: "relationship_proof", label: "Proof of genuine relationship (photos, communication)" },
    { id: "birth_certs",     label: "Birth certificates (dependents)" },
  ],
  "Study Permit": [
    { id: "acceptance_letter", label: "Letter of acceptance from DLI" },
    { id: "ielts_results",     label: "Language test results" },
    { id: "transcripts",       label: "Academic transcripts" },
    { id: "study_plan",        label: "Statement of purpose / study plan" },
    { id: "proof_funds",       label: "Proof of financial support" },
  ],
  "Work Permit": [
    { id: "lmia_job_offer",  label: "LMIA-approved job offer or LMIA-exempt offer" },
    { id: "employment_contract", label: "Signed employment contract" },
    { id: "ielts_results",   label: "Language test results (if required)" },
    { id: "qualifications",  label: "Educational / professional qualifications" },
    { id: "resume",          label: "Current resume" },
  ],
};

const IRCC_FORMS: Record<string, { code: string; name: string }[]> = {
  "Express Entry": [
    { code: "IMM 0008", name: "Generic Application Form for Canada" },
    { code: "IMM 5669", name: "Schedule A — Background/Declaration" },
    { code: "IMM 5406", name: "Additional Family Information" },
    { code: "IMM 5562", name: "Supplementary Information — Your Travels" },
  ],
  "PNP": [
    { code: "IMM 0008", name: "Generic Application Form for Canada" },
    { code: "IMM 5669", name: "Schedule A — Background/Declaration" },
    { code: "IMM 5406", name: "Additional Family Information" },
  ],
  "Family Sponsorship": [
    { code: "IMM 1344", name: "Application to Sponsor & Undertaking" },
    { code: "IMM 0008", name: "Generic Application Form for Canada" },
    { code: "IMM 5540", name: "Sponsorship Agreement" },
    { code: "IMM 5490", name: "Sponsor's Financial Evaluation" },
  ],
  "Study Permit": [
    { code: "IMM 1294", name: "Application for Study Permit" },
    { code: "IMM 5707", name: "Family Information" },
  ],
  "Work Permit": [
    { code: "IMM 1295", name: "Application for Work Permit" },
    { code: "IMM 5707", name: "Family Information" },
  ],
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

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-CA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function getChecklistItems(pathway: string | null) {
  const extra = pathway && PATHWAY_CHECKLIST[pathway] ? PATHWAY_CHECKLIST[pathway] : [];
  return [...BASE_CHECKLIST, ...extra];
}

function effectiveStatusStep(caseFile: CaseFile): number {
  const step = STATUS_ORDER[caseFile.status] ?? 0;
  if (caseFile.agreement_signed_at) return Math.max(step, 3);
  if (caseFile.agreement_sent_at) return Math.max(step, 2);
  return step;
}

function ViewSignedAgreementButton({
  caseFile,
  profileId,
}: {
  caseFile: CaseFile;
  profileId: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [agreement, setAgreement] = useState<AgreementData | null>(null);

  const loadDetail = useCallback(async () => {
    if (!caseFile.agreement_token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/case-file/agreement/${caseFile.agreement_token}`, {
        headers: { Accept: "application/json" },
      });
      const json = await res.json();
      if (res.ok) {
        setAgreement(json as AgreementData);
      }
    } finally {
      setLoading(false);
    }
  }, [caseFile.agreement_token]);

  useEffect(() => {
    if (open) loadDetail();
  }, [open, loadDetail]);

  const pdfUrl = agreement?.case_file?.signed_document_path ?? caseFile.signed_document_path;
  const signedAt = agreement?.case_file?.agreement_signed_at ?? caseFile.agreement_signed_at;

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="gap-1.5 shrink-0"
        onClick={() => setOpen(true)}
      >
        <Eye className="h-3.5 w-3.5" />
        View Signed Agreement
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl w-[95vw] max-h-[92vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <DialogTitle>Signed Retainer Agreement</DialogTitle>
            <DialogDescription>
              {agreement?.client_name ? `${agreement.client_name} — ` : ""}
              {signedAt ? `Signed on ${fmtDateTime(signedAt)}` : "Agreement signed by client"}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
            {loading && (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading agreement…
              </div>
            )}

            {!loading && pdfUrl && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-sm font-medium">Signed PDF uploaded by client</p>
                  <Button asChild size="sm" variant="outline" className="gap-1.5">
                    <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open in new tab
                    </a>
                  </Button>
                </div>
                <iframe
                  src={pdfUrl}
                  title="Signed retainer agreement PDF"
                  className="w-full h-[70vh] rounded-lg border bg-muted/20"
                />
              </div>
            )}

            {!loading && !pdfUrl && agreement && (
              <SignedRetainerAgreementPreview data={agreement} />
            )}

            {!loading && !pdfUrl && !agreement && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Could not load agreement. Try opening the agreement page instead.
              </p>
            )}
          </div>

          <div className="px-6 py-4 border-t shrink-0 flex justify-end gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/dashboard/clients/${profileId}/workspace/retainer-agreement`}>
                Agreement Editor
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Step indicator ─────────────────────────────────────────────────────────────

const STEPS = [
  { label: "Pathway Recommendation", icon: Briefcase },
  { label: "Retainer Agreement", icon: FileText },
  { label: "Case Management", icon: UserCheck },
];

function StepIndicator({ currentStatus, formsVerified }: { currentStatus: string; formsVerified: boolean }) {
  const order = STATUS_ORDER[currentStatus] ?? 0;
  const currentStep = formsVerified && order >= 3 ? 2 : order >= 1 ? 1 : 0;

  return (
    <div className="flex items-center gap-0 mb-8 overflow-x-auto pb-1">
      {STEPS.map((s, i) => {
        const done    = i < currentStep || (i === 1 && order >= 3);
        const current = i === currentStep;
        const locked  = i > currentStep && !(i === 1 && order >= 3 && !formsVerified);
        const Icon = s.icon;
        return (
          <div key={i} className="flex items-center gap-0 flex-1 min-w-0">
            <div className={cn(
              "flex flex-col items-center gap-1 px-2 py-2 rounded-xl flex-1 transition-colors",
              done    && "text-green-700",
              current && "text-primary",
              locked  && "text-muted-foreground/50"
            )}>
              <div className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full border-2 shrink-0",
                done    && "bg-green-50 border-green-500",
                current && "bg-primary/10 border-primary",
                locked  && "bg-muted border-muted-foreground/20"
              )}>
                {done
                  ? <CheckCircle2 className="h-5 w-5 text-green-600" />
                  : locked
                    ? <Lock className="h-4 w-4" />
                    : <Icon className="h-4 w-4" />}
              </div>
              <span className="text-[11px] font-medium text-center leading-tight hidden sm:block">
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn("h-0.5 w-6 shrink-0 mx-1 rounded", done ? "bg-green-400" : "bg-muted")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function WorkspacePageClient({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) {
  const { id } = use(paramsPromise);

  const [caseFile, setCaseFile] = useState<CaseFile | null>(null);
  const [client,   setClient]   = useState<ClientData | null>(null);
  const [verification, setVerification] = useState<FormsVerification | null>(null);
  const [hubPreview, setHubPreview] = useState<{
    progress?: { overall_percent: number; documents: { approved: number; total: number } };
    ircc_forms?: { code: string; name: string; type: string }[];
    document_requirements?: { id: string; label: string; status: string }[];
  } | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [acting,   setActing]   = useState(false);
  const [toast,    setToast]    = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // Checklist state (local mirror)
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res  = await fetch(`${API}/consultant/clients/${id}/case-file`, { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "Failed to load workspace.");
      setCaseFile(json.case_file);
      setClient(json.client);
      setVerification(json.application_forms_verification ?? null);
      setChecklist(json.case_file?.checklist_data ?? {});
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load workspace.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  const reloadVerification = useCallback(async () => {
    try {
      const res = await fetch(`${API}/consultant/clients/${id}/interactive-forms/verification-status`, {
        headers: authHeaders(),
      });
      const json = await res.json();
      if (res.ok) {
        setVerification(json.verification ?? null);
        if (json.verification?.verified_at) {
          setCaseFile((prev) => prev ? { ...prev, application_forms_verified_at: json.verification.verified_at } : prev);
        }
      }
    } catch {
      // ignore refresh errors
    }
  }, [id]);

  const loadHubPreview = useCallback(async () => {
    try {
      const res = await fetch(`${API}/consultant/clients/${id}/case-management-hub`, { headers: authHeaders() });
      const json = await res.json();
      if (res.ok && json.case_management_unlocked) {
        setHubPreview({
          progress: json.progress,
          ircc_forms: json.ircc_forms,
          document_requirements: json.document_requirements,
        });
      }
    } catch {
      // optional preview
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!caseFile) return;
    const unlocked = verification?.case_management_unlocked ?? Boolean(caseFile.application_forms_verified_at);
    if (unlocked) loadHubPreview();
  }, [verification, caseFile, loadHubPreview]);

  const act = async (url: string, method: string, body?: object) => {
    setActing(true);
    try {
      const res  = await fetch(url, { method, headers: authHeaders(), body: body ? JSON.stringify(body) : undefined });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "Action failed.");
      setCaseFile(json.case_file);
      setChecklist(json.case_file?.checklist_data ?? checklist);
      showToast(json.message ?? "Done.");
      return json;
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Action failed.", "error");
    } finally {
      setActing(false);
    }
  };

  const sendAgreement = () =>
    act(`${API}/consultant/clients/${id}/case-file/send-agreement`, "POST");

  const toggleCheckItem = async (itemId: string) => {
    const updated = { ...checklist, [itemId]: !checklist[itemId] };
    setChecklist(updated);
    await act(`${API}/consultant/clients/${id}/case-file/checklist`, "PATCH", { checklist_data: updated });
  };

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center py-40">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !caseFile || !client) {
    return (
      <div className="flex flex-col items-center justify-center py-40 text-center gap-4">
        <AlertCircle className="h-10 w-10 text-red-400" />
        <p className="text-lg font-semibold">{error || "Failed to load workspace."}</p>
        <Button variant="outline" asChild>
          <Link href={`/dashboard/clients/${id}`}><ArrowLeft className="mr-2 h-4 w-4" />Back to Profile</Link>
        </Button>
      </div>
    );
  }

  const statusStep = effectiveStatusStep(caseFile);
  const caseManagementUnlocked = verification?.case_management_unlocked ?? Boolean(caseFile.application_forms_verified_at);
  const checklistItems = getChecklistItems(caseFile.immigration_pathway);
  const formsForPathway = caseFile.immigration_pathway ? (IRCC_FORMS[caseFile.immigration_pathway] ?? []) : [];

  return (
    <div className="max-w-3xl mx-auto pb-16">
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

      {/* Back + Header */}
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href={`/dashboard/clients/${id}`}><ArrowLeft className="mr-1.5 h-4 w-4" />Back to Profile</Link>
        </Button>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Case Workspace</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{client.user.name} &mdash; {client.user.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cn(
            "text-xs px-3 py-1",
            statusStep === 3 ? "bg-green-50 text-green-700 border-green-200"
            : statusStep >= 1 ? "bg-blue-50 text-blue-700 border-blue-200"
            : "bg-amber-50 text-amber-700 border-amber-200"
          )}>
            {STATUS_LABELS[caseFile.status] ?? caseFile.status}
          </Badge>
          <Button variant="ghost" size="icon" onClick={load} disabled={loading || acting}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Step Indicator */}
      <StepIndicator currentStatus={caseFile.status} formsVerified={caseManagementUnlocked} />

      {/* ── STEP 1 — Pathway Recommendation ── */}
      <div className={cn(
        "rounded-xl border p-6 mb-4 transition-opacity",
        statusStep > 1 && "opacity-60"
      )}>
        <div className="flex items-center gap-3 mb-4">
          <div className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full shrink-0",
            statusStep >= 2 ? "bg-green-100 text-green-600" : "bg-primary/10 text-primary"
          )}>
            {statusStep >= 2 ? <CheckCircle2 className="h-5 w-5" /> : <span className="text-sm font-bold">1</span>}
          </div>
          <div>
            <h2 className="font-semibold">Pathway Recommendation</h2>
            <p className="text-xs text-muted-foreground">Review the client&apos;s profile and assign the recommended immigration pathway</p>
          </div>
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <Link href={`/dashboard/clients/${id}/workspace/pathway-calculator`}>
              <Button variant="outline" size="sm" className="gap-1.5">
                <UserCheck className="h-3.5 w-3.5" />
                Pathway Calculator
              </Button>
            </Link>
            <Link href={`/dashboard/clients/${id}/workspace/questionnaire-review`}>
              <Button variant="outline" size="sm" className="gap-1.5">
                <ClipboardList className="h-3.5 w-3.5" />
                View Q&amp;A
              </Button>
            </Link>
          </div>
        </div>

        {/* Assigned Pathway Display */}
        {caseFile.immigration_pathway ? (
          <div className="flex items-center gap-3 rounded-lg bg-green-50 border border-green-200 px-4 py-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-green-700 font-medium uppercase tracking-wide mb-0.5">Assigned Pathway</p>
              <p className="text-sm font-semibold text-green-900 truncate">{caseFile.immigration_pathway}</p>
            </div>
            <Link href={`/dashboard/clients/${id}/workspace/pathway-calculator`}>
              <Button variant="outline" size="sm" className="text-green-700 border-green-300 hover:bg-green-100 gap-1.5 shrink-0">
                <UserCheck className="h-3.5 w-3.5" />
                Change
              </Button>
            </Link>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg bg-muted/40 border border-dashed px-4 py-3 text-muted-foreground">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <p className="text-sm">No pathway assigned yet. Use the <strong>Pathway Calculator</strong> above to review scores and assign the best pathway to this client.</p>
          </div>
        )}

      </div>

      {/* ── STEP 2 — Retainer Agreement ── */}
      <div className={cn(
        "rounded-xl border p-6 mb-4 transition-opacity",
        statusStep < 1 && "opacity-50 pointer-events-none",
        statusStep > 2 && caseManagementUnlocked && "opacity-60"
      )}>
        <div className="flex items-center gap-3 mb-4">
          <div className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full shrink-0",
            statusStep >= 3 ? "bg-green-100 text-green-600" : statusStep >= 1 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          )}>
            {statusStep >= 3 ? <CheckCircle2 className="h-5 w-5" /> : statusStep < 1 ? <Lock className="h-4 w-4" /> : <span className="text-sm font-bold">2</span>}
          </div>
          <div>
            <h2 className="font-semibold">Retainer Agreement</h2>
            <p className="text-xs text-muted-foreground">Send the retainer agreement for the client to review and sign digitally</p>
          </div>
          <div className="ml-auto">
            <Link href={`/dashboard/clients/${id}/workspace/retainer-agreement`}>
              <Button size="sm" variant="outline" className="gap-1.5" disabled={statusStep < 1}>
                <FileText className="h-3.5 w-3.5" />
                {caseFile.agreement_sent_at ? "Manage Agreement" : "Create Agreement"}
              </Button>
            </Link>
          </div>
        </div>

        {statusStep < 1 ? (
          <p className="text-sm text-muted-foreground italic">Complete Step 1 to unlock this section.</p>
        ) : statusStep >= 3 ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-800">Agreement signed</p>
              <p className="text-xs text-green-700">Signed on {fmtDateTime(caseFile.agreement_signed_at)}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {caseFile.status === "PATHWAY_SELECTED" && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                <FileText className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-800">Ready to create retainer agreement</p>
                  <p className="text-xs text-blue-700 mt-0.5">
                    Click <strong>Create Agreement</strong> above to build a professional, customizable agreement for{" "}
                    <strong>{caseFile.immigration_pathway}</strong> and send it directly to the client.
                  </p>
                </div>
              </div>
            )}
            {caseFile.status === "AGREEMENT_SENT" && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                <Clock className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-800">Agreement sent — awaiting client signature</p>
                  <p className="text-xs text-amber-700 mt-1">Sent on {fmtDateTime(caseFile.agreement_sent_at)}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── STEP 2.5 — Verify Application Forms ── */}
      <div className={cn(
        "rounded-xl border p-6 mb-4 transition-opacity",
        statusStep < 3 && "opacity-50 pointer-events-none",
        caseManagementUnlocked && "opacity-60"
      )}>
        <div className="flex items-center gap-3 mb-4">
          <div className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full shrink-0",
            caseManagementUnlocked ? "bg-green-100 text-green-600" : statusStep >= 3 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          )}>
            {caseManagementUnlocked ? <CheckCircle2 className="h-5 w-5" /> : statusStep < 3 ? <Lock className="h-4 w-4" /> : <FormInput className="h-4 w-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold">Verify Application Forms</h2>
            <p className="text-xs text-muted-foreground">
              Review client-submitted forms before unlocking Full Case Management
            </p>
          </div>
          {verification && verification.total_forms > 0 && statusStep >= 3 && (
            <Badge variant="outline" className="shrink-0 text-xs">
              {verification.reviewed_count}/{verification.total_forms} reviewed
            </Badge>
          )}
          {statusStep >= 3 && caseFile.agreement_signed_at && (
            <ViewSignedAgreementButton caseFile={caseFile} profileId={id} />
          )}
        </div>

        {statusStep < 3 ? (
          <p className="text-sm text-muted-foreground italic">
            Unlocks after the retainer agreement is signed by the client.
          </p>
        ) : caseManagementUnlocked ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-800">Application forms verified</p>
              <p className="text-xs text-green-700">
                Verified on {fmtDateTime(verification?.verified_at ?? caseFile.application_forms_verified_at)} — Full Case Management is now unlocked.
              </p>
            </div>
          </div>
        ) : verification && verification.total_forms === 0 ? (
          <p className="text-sm text-muted-foreground italic">No interactive forms for this package — verification not required.</p>
        ) : (
          <div className="space-y-4">
            {verification && !verification.all_submitted && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
                Waiting for client to submit all forms ({verification.submitted_count}/{verification.total_forms} submitted).
              </div>
            )}
            {verification && verification.all_submitted && !verification.all_reviewed && (
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800">
                Client submitted all forms. Review each form below and click <strong>Mark reviewed</strong> to unlock Full Case Management.
              </div>
            )}
            <ConsultantInteractiveFormsPanel profileId={id} onVerificationChange={reloadVerification} />
          </div>
        )}
      </div>

      {/* ── STEP 3 — Case Management ── */}
      <div className={cn(
        "rounded-xl border p-6 transition-opacity",
        !caseManagementUnlocked && "opacity-50 pointer-events-none"
      )}>
        <div className="flex items-center gap-3 mb-4">
          <div className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full shrink-0",
            caseManagementUnlocked ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          )}>
            {!caseManagementUnlocked ? <Lock className="h-4 w-4" /> : <span className="text-sm font-bold">3</span>}
          </div>
          <div>
            <h2 className="font-semibold">Full Case Management</h2>
            <p className="text-xs text-muted-foreground">Document checklist and IRCC forms — unlocked after application forms are verified</p>
          </div>
        </div>

        {!caseManagementUnlocked ? (
          <p className="text-sm text-muted-foreground italic">
            {statusStep < 3
              ? "Sign the retainer agreement first, then verify application forms."
              : "Review and mark all client application forms as reviewed to unlock this section."}
          </p>
        ) : (
          <div className="space-y-4">
            {hubPreview?.progress && (
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-sm font-semibold">Case hub is active</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {hubPreview.progress.documents.approved}/{hubPreview.progress.documents.total} documents approved
                    · {hubPreview.progress.overall_percent}% overall progress
                  </p>
                </div>
                <Badge className="bg-primary/10 text-primary border-primary/20">
                  {hubPreview.progress.overall_percent}% complete
                </Badge>
              </div>
            )}

            {(hubPreview?.ircc_forms?.length ?? 0) > 0 && (
              <div>
                <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Required IRCC Forms
                  {caseFile.immigration_pathway && (
                    <Badge variant="outline" className="text-xs font-normal">{caseFile.immigration_pathway}</Badge>
                  )}
                </p>
                <div className="space-y-2">
                  {hubPreview!.ircc_forms!.slice(0, 5).map((form, i) => (
                    <div key={`${form.code}-${i}`} className="flex items-center gap-3 rounded-lg border px-4 py-2.5 text-sm">
                      <span className="font-mono text-primary shrink-0">{form.code}</span>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground truncate">{form.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Manage documents, review uploads, update pipeline status, and message your client in the full hub.
            </p>
          </div>
        )}

        {/* Go to Full Case Management button */}
        {caseManagementUnlocked && (
          <div className="mt-6 flex justify-end">
            <Link href={`/dashboard/clients/${id}/workspace/case-management`}>
              <Button className="gap-2">
                <Briefcase className="h-4 w-4" />
                Go to Full Case Management
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
