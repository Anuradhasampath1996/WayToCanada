"use client";

import { use, useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft, Loader2, AlertCircle, CheckCircle2, Clock,
  ChevronRight, FileText, Briefcase,
  Eye, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ConsultantInteractiveFormsPanel } from "./case-management/consultant-interactive-forms-panel";
import { WorkspaceHero } from "./workspace-hero";
import {
  SignedRetainerAgreementPreview,
  type AgreementData,
} from "@/components/signed-retainer-agreement-preview";
import {
  buildClientActivity,
  ClientActivityTimeline,
  IntakeTaskCards,
  WorkspaceStepRail,
} from "./workspace-flow-ui";
import {
  buildQuestionnaireStats,
  type QuestionnaireSubmissionSnapshot,
  type QuestionnaireWorkspaceStats,
} from "@/lib/questionnaire-workspace-stats";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

// ── Types ──────────────────────────────────────────────────────────────────────

const STATUS_ORDER: Record<string, number> = {
  PENDING_ASSESSMENT:   0,
  PATHWAY_SELECTED:     1,
  AGREEMENT_SENT:       2,
  AGREEMENT_SIGNED:     3,
};

interface CaseFile {
  id: number;
  case_number?: number;
  lifecycle_status?: string;
  lifecycle_note?: string | null;
  status: string;
  immigration_pathway: string | null;
  agreement_token: string | null;
  agreement_sent_at: string | null;
  agreement_signed_at: string | null;
  application_forms_verified_at: string | null;
  signed_document_path: string | null;
  client_signature: string | null;
  pathway_assessment_notes?: string | null;
  pathway_assessment_crs_score?: number | null;
  pathway_assessment_ircc_crs_score?: number | null;
  pathway_assessment_at?: string | null;
  pathway_assessment_rules_version?: string | null;
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
        <DialogContent className="flex max-h-[92vh] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl sm:w-[95vw]">
          <DialogHeader className="shrink-0 border-b px-4 py-4 sm:px-6 sm:pt-6">
            <DialogTitle>Signed Retainer Agreement</DialogTitle>
            <DialogDescription>
              {agreement?.client_name ? `${agreement.client_name} — ` : ""}
              {signedAt ? `Signed on ${fmtDateTime(signedAt)}` : "Agreement signed by client"}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
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
                  className="h-[min(60vh,520px)] w-full rounded-lg border bg-muted/20 sm:h-[70vh]"
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

          <div className="flex shrink-0 flex-col gap-2 border-t px-4 py-4 sm:flex-row sm:justify-end sm:px-6">
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

// ── Step helpers ───────────────────────────────────────────────────────────────

function getUnlockedStepIndex(caseFile: CaseFile, caseManagementUnlocked: boolean): number {
  if (caseManagementUnlocked) return 3;
  if (caseFile.agreement_signed_at) return 2;
  if (caseFile.immigration_pathway) return 1;
  return 0;
}

function CurrentStepPanel({
  viewStep,
  unlockedStep,
  onViewStep,
  profileId,
  caseFile,
  qStats,
  verification,
  caseManagementUnlocked,
  hubPreview,
  reloadVerification,
}: {
  viewStep: number;
  unlockedStep: number;
  onViewStep: (step: number) => void;
  profileId: string;
  caseFile: CaseFile;
  qStats: QuestionnaireWorkspaceStats;
  verification: FormsVerification | null;
  caseManagementUnlocked: boolean;
  hubPreview: {
    progress?: { overall_percent: number; documents: { approved: number; total: number } };
  } | null;
  reloadVerification: () => void;
}) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="border-b border-border/50 pb-3">
        <CardTitle className="text-base">What to do now</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        {viewStep < unlockedStep && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200/50 bg-emerald-500/[0.05] px-3 py-2 text-xs text-emerald-800 dark:text-emerald-300">
            <span>This step is complete.</span>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs text-emerald-800 underline-offset-2 dark:text-emerald-300"
              onClick={() => onViewStep(unlockedStep)}
            >
              Go to current step →
            </Button>
          </div>
        )}

        {viewStep === 0 && (
          <>
            <p className="text-sm text-muted-foreground">
              {!qStats.isSubmitted
                ? "Start with the questionnaire review. Once the client submits, assign their immigration pathway."
                : "Questionnaire received — review answers, then open the pathway calculator to assign a route."}
            </p>
            <IntakeTaskCards
              profileId={profileId}
              qStats={qStats}
              pathwayAssigned={caseFile.immigration_pathway}
            />
          </>
        )}

        {viewStep === 1 && (
          <>
            {caseFile.agreement_signed_at ? (
              <StatusBanner tone="success" icon={CheckCircle2} title="Agreement signed">
                Signed on {fmtDateTime(caseFile.agreement_signed_at)}. You can move on to form verification.
              </StatusBanner>
            ) : caseFile.agreement_sent_at ? (
              <StatusBanner tone="warning" icon={Clock} title="Waiting for client signature">
                Agreement sent on {fmtDateTime(caseFile.agreement_sent_at)}. Follow up if the client has not signed yet.
              </StatusBanner>
            ) : (
              <p className="text-sm text-muted-foreground">
                Build the retainer agreement for <strong className="text-foreground">{caseFile.immigration_pathway}</strong> and send it to the client for signature.
              </p>
            )}
            <Button className="h-10 rounded-xl" asChild>
              <Link href={`/dashboard/clients/${profileId}/workspace/retainer-agreement`}>
                <FileText className="mr-2 size-4" />
                {caseFile.agreement_sent_at ? "Manage agreement" : "Create retainer agreement"}
              </Link>
            </Button>
          </>
        )}

        {viewStep === 2 && (
          <>
            {caseManagementUnlocked ? (
              <StatusBanner tone="success" icon={CheckCircle2} title="Forms verified">
                Verified on {fmtDateTime(verification?.verified_at ?? caseFile.application_forms_verified_at)} — case hub is ready.
              </StatusBanner>
            ) : verification && verification.total_forms === 0 ? (
              <p className="text-sm text-muted-foreground">No interactive forms for this package. You can proceed to the case hub.</p>
            ) : (
              <>
                {verification && !verification.all_submitted && (
                  <p className="text-sm text-muted-foreground">
                    Waiting for client submissions ({verification.submitted_count}/{verification.total_forms} forms submitted).
                  </p>
                )}
                {verification && verification.all_submitted && !verification.all_reviewed && (
                  <p className="text-sm text-muted-foreground">
                    All forms submitted. Mark each form as reviewed to unlock the case hub.
                  </p>
                )}
                <ConsultantInteractiveFormsPanel profileId={profileId} onVerificationChange={reloadVerification} />
              </>
            )}
            {caseFile.agreement_signed_at && (
              <ViewSignedAgreementButton caseFile={caseFile} profileId={profileId} />
            )}
          </>
        )}

        {viewStep === 3 && (
          <>
            {hubPreview?.progress && (
              <p className="text-sm text-muted-foreground">
                {hubPreview.progress.documents.approved}/{hubPreview.progress.documents.total} documents approved ·{" "}
                {hubPreview.progress.overall_percent}% overall progress
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              Documents, IRCC forms, pipeline, and client communication — all in one place.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button className="h-10 rounded-xl" asChild>
                <Link href={`/dashboard/clients/${profileId}/workspace/case-management`}>
                  <Briefcase className="mr-2 size-4" />
                  Open case hub
                  <ChevronRight className="ml-1 size-4" />
                </Link>
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBanner({
  tone,
  icon: Icon,
  title,
  children,
}: {
  tone: "success" | "info" | "warning";
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  const styles = {
    success: "border-emerald-200/70 bg-emerald-500/[0.06] text-emerald-900",
    info: "border-blue-200/70 bg-blue-500/[0.06] text-blue-900",
    warning: "border-amber-200/70 bg-amber-500/[0.06] text-amber-900",
  };
  const iconStyles = {
    success: "text-emerald-600",
    info: "text-blue-600",
    warning: "text-amber-600",
  };

  return (
    <div className={cn("flex items-start gap-3 rounded-xl border px-4 py-3.5", styles[tone])}>
      <Icon className={cn("mt-0.5 size-5 shrink-0", iconStyles[tone])} />
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <div className="mt-0.5 text-xs opacity-90">{children}</div>
      </div>
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
  const [qStats, setQStats] = useState<QuestionnaireWorkspaceStats>(buildQuestionnaireStats(null));

  const loadQuestionnaireStats = useCallback(async () => {
    try {
      const res = await fetch(`${API}/consultant/clients/${id}/questionnaire`, { headers: authHeaders() });
      if (!res.ok) return;
      const json = await res.json();
      setQStats(buildQuestionnaireStats(json.submission as QuestionnaireSubmissionSnapshot | null));
    } catch {
      // optional
    }
  }, [id]);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res  = await fetch(`${API}/consultant/clients/${id}/case-file`, { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "Failed to load workspace.");
      setCaseFile(json.case_file);
      setClient(json.client);
      setVerification(json.application_forms_verification ?? null);
      await loadQuestionnaireStats();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load workspace.");
    } finally {
      setLoading(false);
    }
  }, [id, loadQuestionnaireStats]);

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

  const [viewStep, setViewStep] = useState(0);
  const prevUnlockedRef = useRef(-1);

  const caseManagementUnlocked =
    verification?.case_management_unlocked ?? Boolean(caseFile?.application_forms_verified_at);
  const unlockedStep = caseFile ? getUnlockedStepIndex(caseFile, caseManagementUnlocked) : 0;

  useEffect(() => {
    if (!caseFile) return;
    if (prevUnlockedRef.current < 0 || unlockedStep > prevUnlockedRef.current) {
      setViewStep(unlockedStep);
    }
    prevUnlockedRef.current = unlockedStep;
  }, [unlockedStep, caseFile]);

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-40 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
        Loading workspace…
      </div>
    );
  }

  if (error || !caseFile || !client) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-40 text-center">
        <AlertCircle className="size-10 text-destructive/70" />
        <p className="text-lg font-semibold">{error || "Failed to load workspace."}</p>
        <Button variant="outline" asChild className="rounded-xl">
          <Link href={`/dashboard/clients/${id}`}>
            <ArrowLeft className="mr-2 size-4" />
            Back to profile
          </Link>
        </Button>
      </div>
    );
  }

  const statusStep = effectiveStatusStep(caseFile);
  const statusTone: "amber" | "blue" | "emerald" =
    statusStep === 3 ? "emerald" : statusStep >= 1 ? "blue" : "amber";

  const activityEvents = buildClientActivity(qStats, caseFile, verification);

  return (
    <div className="space-y-4 sm:space-y-6">
      <WorkspaceHero
        profileId={id}
        clientName={client.user.name}
        clientEmail={client.user.email}
        activeStep={viewStep}
        status={caseFile.status}
        statusTone={statusTone}
        pathway={caseFile.immigration_pathway}
        loading={loading}
        onRefresh={load}
      />

      <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5 sm:px-4">
        <WorkspaceStepRail
          unlockedStep={unlockedStep}
          viewStep={viewStep}
          onViewStep={setViewStep}
        />
      </div>

      <div className="grid min-w-0 gap-4 sm:gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <aside className="order-1 min-w-0 xl:order-2 xl:sticky xl:top-4 xl:self-start">
          <ClientActivityTimeline events={activityEvents} />
        </aside>

        <div className="order-2 min-w-0 xl:order-1 xl:pr-2">
          <CurrentStepPanel
            viewStep={viewStep}
            unlockedStep={unlockedStep}
            onViewStep={setViewStep}
            profileId={id}
            caseFile={caseFile}
            qStats={qStats}
            verification={verification}
            caseManagementUnlocked={caseManagementUnlocked}
            hubPreview={hubPreview}
            reloadVerification={reloadVerification}
          />
        </div>
      </div>
    </div>
  );
}
