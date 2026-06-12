"use client";

import { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft, Loader2, AlertCircle, Send, CheckCircle2, Clock, Lock,
  ChevronRight, FileText, ClipboardList, Briefcase, UserCheck,
  Check, RefreshCw, FormInput, Eye, ExternalLink, GraduationCap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { PathwayRecommendationPanel } from "./pathway-recommendation-panel";
import { ConsultantInteractiveFormsPanel } from "./case-management/consultant-interactive-forms-panel";
import {
  SignedRetainerAgreementPreview,
  type AgreementData,
} from "@/components/signed-retainer-agreement-preview";
import {
  buildClientActivity,
  ClientActivityTimeline,
  AssessmentSubProgress,
  NextActionCard,
  QuestionnaireGateBanner,
  resolveNextAction,
} from "./workspace-flow-ui";
import {
  buildQuestionnaireStats,
  type QuestionnaireSubmissionSnapshot,
  type QuestionnaireWorkspaceStats,
} from "@/lib/questionnaire-workspace-stats";
import { WorkspaceQuickToolsRail } from "./workspace-quick-tools-rail";

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
  { label: "Pathway", fullLabel: "Pathway assessment", icon: Briefcase },
  { label: "Agreement", fullLabel: "Retainer agreement", icon: FileText },
  { label: "Forms", fullLabel: "Verify application forms", icon: FormInput },
  { label: "Case hub", fullLabel: "Full case management", icon: UserCheck },
];

type WorkflowStepState = "done" | "current" | "locked";

function getActiveStepIndex(caseFile: CaseFile, caseManagementUnlocked: boolean): number {
  if (caseManagementUnlocked) return 3;
  if (caseFile.agreement_signed_at) return 2;
  if (caseFile.immigration_pathway) return 1;
  return 0;
}

function stepUiState(stepIndex: number, activeStep: number): WorkflowStepState {
  if (stepIndex < activeStep) return "done";
  if (stepIndex === activeStep) return "current";
  return "locked";
}

function StepIndicator({ caseFile, caseManagementUnlocked }: { caseFile: CaseFile; caseManagementUnlocked: boolean }) {
  const activeStep = getActiveStepIndex(caseFile, caseManagementUnlocked);

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {STEPS.map((s, i) => {
        const done = i < activeStep;
        const current = i === activeStep;
        const locked = i > activeStep;
        const Icon = s.icon;
        return (
          <div
            key={s.label}
            className={cn(
              "flex items-center gap-3 rounded-xl border px-3 py-3 transition-colors",
              done && "border-emerald-200/60 bg-emerald-500/[0.06]",
              current && "border-primary/30 bg-primary/[0.05]",
              locked && "border-border/60 bg-muted/15 opacity-80",
            )}
          >
            <div
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg",
                done && "bg-emerald-500/15 text-emerald-700",
                current && "bg-primary/15 text-primary",
                locked && "bg-muted text-muted-foreground",
              )}
            >
              {done ? (
                <CheckCircle2 className="size-4" />
              ) : locked ? (
                <Lock className="size-3.5" />
              ) : (
                <Icon className="size-4" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Step {i + 1}</p>
              <p className="truncate text-sm font-semibold leading-tight">{s.fullLabel}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WorkflowSection({
  step,
  title,
  subtitle,
  state,
  headerActions,
  children,
  className,
}: {
  step: number;
  title: string;
  subtitle: string;
  state: WorkflowStepState;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const locked = state === "locked";
  const done = state === "done";

  return (
    <Card
      className={cn(
        "border-border/70 shadow-sm transition-opacity",
        locked && "pointer-events-none opacity-50",
        className,
      )}
    >
      <CardHeader className="border-b border-border/50 pb-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold",
                done && "bg-emerald-500/15 text-emerald-700",
                state === "current" && "bg-primary/15 text-primary",
                locked && "bg-muted text-muted-foreground",
              )}
            >
              {done ? <CheckCircle2 className="size-5" /> : locked ? <Lock className="size-4" /> : step}
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription className="mt-1">{subtitle}</CardDescription>
            </div>
          </div>
          {headerActions ? <div className="flex shrink-0 flex-wrap gap-2">{headerActions}</div> : null}
        </div>
      </CardHeader>
      <CardContent className="pt-6">{children}</CardContent>
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
  const [consultantName, setConsultantName] = useState("Consultant");
  const [verification, setVerification] = useState<FormsVerification | null>(null);
  const [hubPreview, setHubPreview] = useState<{
    progress?: { overall_percent: number; documents: { approved: number; total: number } };
    ircc_forms?: { code: string; name: string; type: string }[];
    document_requirements?: { id: string; label: string; status: string }[];
  } | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [acting, setActing] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [qStats, setQStats] = useState<QuestionnaireWorkspaceStats>(buildQuestionnaireStats(null));

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

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
      setConsultantName(json.consultant?.name ?? "Consultant");
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

  const act = async (url: string, method: string, body?: object) => {
    setActing(true);
    try {
      const res  = await fetch(url, { method, headers: authHeaders(), body: body ? JSON.stringify(body) : undefined });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "Action failed.");
      setCaseFile(json.case_file);
      showToast(json.message ?? "Done.");
      return json;
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Action failed.", "error");
    } finally {
      setActing(false);
    }
  };

  async function clearSelectedPathway() {
    setActing(true);
    try {
      const res = await fetch(`${API}/consultant/clients/${id}/case-file/select-pathway`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ immigration_pathway: null }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.message === "string" ? json.message : "Could not clear pathway");
      setCaseFile(prev => prev ? {
        ...prev,
        immigration_pathway: null,
        status: "PENDING_ASSESSMENT",
      } : prev);
      showToast("Pathway selection cleared.");
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Clear failed.", "error");
    } finally {
      setActing(false);
    }
  }

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
  const canClearPathway = Boolean(caseFile.immigration_pathway) && !caseFile.agreement_sent_at;
  const caseManagementUnlocked = verification?.case_management_unlocked ?? Boolean(caseFile.application_forms_verified_at);
  const activeStep = getActiveStepIndex(caseFile, caseManagementUnlocked);

  const pathwayStepState = stepUiState(0, activeStep);
  const agreementStepState = !caseFile.immigration_pathway ? "locked" : stepUiState(1, activeStep);
  const formsStepState = !caseFile.agreement_signed_at ? "locked" : stepUiState(2, activeStep);
  const caseHubStepState = stepUiState(3, activeStep);

  const nextAction = resolveNextAction(id, caseFile, qStats, verification);
  const activityEvents = buildClientActivity(qStats, caseFile, verification);

  return (
    <div className="w-full space-y-6 pb-10">
      {toast && (
        <div
          className={cn(
            "fixed top-4 right-4 z-50 flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm shadow-lg backdrop-blur-sm",
            toast.type === "success"
              ? "border-emerald-200/80 bg-background text-emerald-800"
              : "border-red-200/80 bg-background text-red-700",
          )}
        >
          {toast.type === "success" ? <Check className="size-4 shrink-0" /> : <AlertCircle className="size-4 shrink-0" />}
          {toast.msg}
        </div>
      )}

      <section className="rounded-2xl border border-border/70 bg-gradient-to-br from-background via-background to-primary/5 p-5 shadow-sm md:p-6">
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-4 h-8 px-2 text-muted-foreground">
          <Link href={`/dashboard/clients/${id}`}>
            <ArrowLeft className="mr-1.5 size-4" />
            Back to profile
          </Link>
        </Button>

        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-2">
            <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight md:text-3xl">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Briefcase className="size-5" />
              </span>
              Case workspace
            </h1>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{client.user.name}</span>
              {" · "}
              {client.user.email}
            </p>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Work through assessment, agreement, form review, then full case management — one step at a time.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                "h-7 rounded-lg px-2.5 text-xs",
                statusStep === 3
                  ? "border-emerald-200/60 bg-emerald-500/10 text-emerald-700"
                  : statusStep >= 1
                    ? "border-blue-200/60 bg-blue-500/10 text-blue-700"
                    : "border-amber-200/60 bg-amber-500/10 text-amber-700",
              )}
            >
              {STATUS_LABELS[caseFile.status] ?? caseFile.status}
            </Badge>
            {caseFile.immigration_pathway && (
              <Badge variant="outline" className="h-7 rounded-lg px-2.5 text-xs">
                {caseFile.immigration_pathway}
              </Badge>
            )}
            <Button variant="outline" size="icon" className="size-8 rounded-xl" onClick={load} disabled={loading || acting}>
              <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            </Button>
          </div>
        </div>
      </section>

      <NextActionCard action={nextAction} />

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="text-base">Your progress</CardTitle>
          <CardDescription>
            Step {activeStep + 1} of {STEPS.length}
            {activeStep < STEPS.length ? ` — ${STEPS[activeStep].fullLabel}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          <StepIndicator caseFile={caseFile} caseManagementUnlocked={caseManagementUnlocked} />
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-6 min-w-0 pr-0 xl:pr-2">

      <WorkflowSection
        step={1}
        title="Pathway assessment"
        subtitle="Verify the questionnaire, score CRS, compare routes, and assign the best immigration pathway."
        state={pathwayStepState}
        headerActions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5 rounded-xl" asChild>
              <Link href={`/dashboard/clients/${id}/workspace/pathway-calculator`}>
                <UserCheck className="size-3.5" />
                Full calculator
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 rounded-xl" asChild>
              <Link href={`/dashboard/clients/${id}/workspace/questionnaire-review`}>
                <ClipboardList className="size-3.5" />
                View Q&amp;A
              </Link>
            </Button>
          </>
        }
      >
        <AssessmentSubProgress
          profileId={id}
          qStats={qStats}
          pathwayAssigned={caseFile.immigration_pathway}
          crsScore={caseFile.pathway_assessment_crs_score}
        />

        <QuestionnaireGateBanner qStats={qStats} profileId={id} />

        {caseFile.immigration_pathway && (
          <div className="mb-5 flex flex-col gap-3 rounded-xl border border-emerald-200/70 bg-emerald-500/[0.06] px-4 py-3.5 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-700">Selected pathway</p>
                <p className="truncate text-sm font-semibold text-emerald-900">{caseFile.immigration_pathway}</p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              {canClearPathway && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  disabled={acting}
                  onClick={clearSelectedPathway}
                >
                  Clear
                </Button>
              )}
              <Button variant="outline" size="sm" className="rounded-xl" asChild>
                <Link href={`/dashboard/clients/${id}/workspace/pathway-calculator`}>Edit</Link>
              </Button>
            </div>
          </div>
        )}

        <PathwayRecommendationPanel
          profileId={id}
          caseFile={caseFile}
          clientName={client.user.name}
          consultantName={consultantName}
          onPathwaySelected={(pathway) => {
            setCaseFile((prev) => (prev ? { ...prev, immigration_pathway: pathway, status: "PATHWAY_SELECTED" } : prev));
            showToast("Pathway assigned.");
          }}
          onPathwayCleared={() => {
            setCaseFile((prev) =>
              prev ? { ...prev, immigration_pathway: null, status: "PENDING_ASSESSMENT" } : prev,
            );
            showToast("Pathway selection cleared.");
          }}
          onAssessmentSaved={load}
        />
      </WorkflowSection>

      <WorkflowSection
        step={2}
        title="Retainer agreement"
        subtitle="Create and send the retainer agreement for the client to review and sign digitally."
        state={agreementStepState}
        headerActions={
          !caseFile.immigration_pathway ? (
            <Button size="sm" variant="outline" className="gap-1.5 rounded-xl" disabled>
              <FileText className="size-3.5" />
              Create agreement
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="gap-1.5 rounded-xl" asChild>
              <Link href={`/dashboard/clients/${id}/workspace/retainer-agreement`}>
                <FileText className="size-3.5" />
                {caseFile.agreement_sent_at ? "Manage agreement" : "Create agreement"}
              </Link>
            </Button>
          )
        }
      >
        {!caseFile.immigration_pathway ? (
          <p className="text-sm text-muted-foreground">Assign a pathway in Step 1 to unlock the retainer agreement.</p>
        ) : caseFile.agreement_signed_at ? (
          <StatusBanner tone="success" icon={CheckCircle2} title="Agreement signed">
            Signed on {fmtDateTime(caseFile.agreement_signed_at)}
          </StatusBanner>
        ) : (
          <div className="space-y-3">
            {!caseFile.agreement_sent_at && (
              <StatusBanner tone="info" icon={FileText} title="Ready to create retainer agreement">
                Click <strong>Create agreement</strong> to build a customizable agreement for{" "}
                <strong>{caseFile.immigration_pathway}</strong> and send it to the client.
              </StatusBanner>
            )}
            {caseFile.agreement_sent_at && !caseFile.agreement_signed_at && (
              <StatusBanner tone="warning" icon={Clock} title="Awaiting client signature">
                Agreement sent on {fmtDateTime(caseFile.agreement_sent_at)}
              </StatusBanner>
            )}
          </div>
        )}
      </WorkflowSection>

      <WorkflowSection
        step={3}
        title="Verify application forms"
        subtitle="Review client-submitted forms before unlocking full case management."
        state={formsStepState}
        headerActions={
          <>
            {verification && verification.total_forms > 0 && caseFile.agreement_signed_at && (
              <Badge variant="outline" className="h-7 rounded-lg text-xs">
                {verification.reviewed_count}/{verification.total_forms} reviewed
              </Badge>
            )}
            {caseFile.agreement_signed_at && (
              <ViewSignedAgreementButton caseFile={caseFile} profileId={id} />
            )}
          </>
        }
      >
        {!caseFile.agreement_signed_at ? (
          <p className="text-sm text-muted-foreground">Unlocks after the client signs the retainer agreement.</p>
        ) : caseManagementUnlocked ? (
          <StatusBanner tone="success" icon={CheckCircle2} title="Application forms verified">
            Verified on {fmtDateTime(verification?.verified_at ?? caseFile.application_forms_verified_at)} — full
            case management is now unlocked.
          </StatusBanner>
        ) : verification && verification.total_forms === 0 ? (
          <p className="text-sm text-muted-foreground">No interactive forms for this package — verification not required.</p>
        ) : (
          <div className="space-y-4">
            {verification && !verification.all_submitted && (
              <StatusBanner tone="warning" icon={Clock} title="Waiting for client submissions">
                {verification.submitted_count}/{verification.total_forms} forms submitted so far.
              </StatusBanner>
            )}
            {verification && verification.all_submitted && !verification.all_reviewed && (
              <StatusBanner tone="info" icon={FormInput} title="Ready for your review">
                Client submitted all forms. Mark each form as reviewed to unlock full case management.
              </StatusBanner>
            )}
            <ConsultantInteractiveFormsPanel profileId={id} onVerificationChange={reloadVerification} />
          </div>
        )}
      </WorkflowSection>

      <WorkflowSection
        step={4}
        title="Full case management"
        subtitle="Documents, IRCC forms, pipeline updates, and client communication — all in one hub."
        state={caseHubStepState}
        headerActions={
          caseManagementUnlocked ? (
            <Button className="gap-2 rounded-xl" asChild>
              <Link href={`/dashboard/clients/${id}/workspace/case-management`}>
                <Briefcase className="size-4" />
                Open case hub
                <ChevronRight className="size-4" />
              </Link>
            </Button>
          ) : undefined
        }
      >
        {!caseManagementUnlocked ? (
          <p className="text-sm text-muted-foreground">
            {!caseFile.agreement_signed_at
              ? "Complete the retainer agreement and form verification first."
              : "Review and approve all client application forms to unlock this section."}
          </p>
        ) : (
          <div className="space-y-4">
            {hubPreview?.progress && (
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-primary/20 bg-primary/[0.04] px-4 py-3.5">
                <div>
                  <p className="text-sm font-semibold">Case hub is active</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {hubPreview.progress.documents.approved}/{hubPreview.progress.documents.total} documents approved ·{" "}
                    {hubPreview.progress.overall_percent}% overall progress
                  </p>
                </div>
                <Badge className="rounded-lg border-primary/20 bg-primary/10 text-primary">
                  {hubPreview.progress.overall_percent}% complete
                </Badge>
              </div>
            )}

            {(hubPreview?.ircc_forms?.length ?? 0) > 0 && (
              <div className="space-y-2">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <FileText className="size-4 text-primary" />
                  Required IRCC forms
                  {caseFile.immigration_pathway && (
                    <Badge variant="outline" className="text-[10px] font-normal">
                      {caseFile.immigration_pathway}
                    </Badge>
                  )}
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {hubPreview!.ircc_forms!.slice(0, 6).map((form, i) => (
                    <div
                      key={`${form.code}-${i}`}
                      className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/10 px-3 py-2.5 text-sm"
                    >
                      <span className="shrink-0 font-mono text-xs text-primary">{form.code}</span>
                      <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
                      <span className="truncate text-muted-foreground">{form.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-sm text-muted-foreground">
              Manage document uploads, review client files, update application progress, and keep the case moving forward.
            </p>
          </div>
        )}
      </WorkflowSection>

      <WorkflowSection
        step={5}
        title="Exam prep courses (LMS)"
        subtitle="Assign IELTS, PTE, NCLEX, or TEF master courses and track lesson progress and quiz scores."
        state="current"
        headerActions={
          <Button className="gap-2 rounded-xl" variant="outline" asChild>
            <Link href={`/dashboard/clients/${id}/workspace/lms`}>
              <GraduationCap className="size-4" />
              Manage courses
              <ChevronRight className="size-4" />
            </Link>
          </Button>
        }
      >
        <p className="text-sm text-muted-foreground">
          Assign published courses from the admin catalog, then monitor completion percentage and MCQ quiz pass/fail results here.
        </p>
      </WorkflowSection>

        </div>

        <aside className="xl:sticky xl:top-4 xl:self-start">
          <ClientActivityTimeline events={activityEvents} />
        </aside>
      </div>

      <WorkspaceQuickToolsRail clientId={Number(id)} />
    </div>
  );
}
