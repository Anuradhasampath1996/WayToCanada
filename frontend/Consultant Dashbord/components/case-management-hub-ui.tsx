"use client";

import Link from "next/link";
import {
  CheckCircle2, Clock, FileText, FormInput, AlertCircle,
  ChevronRight, ExternalLink, Briefcase, ClipboardList, Eye, RotateCcw,
  FileCheck, MessageSquare,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ConsultantDocumentPreviewCard,
  type ConsultantDocumentItem,
} from "@/components/consultant-document-preview-card";

export interface HubProgress {
  overall_percent: number;
  documents: { total: number; approved: number; pending: number; missing: number; rejected: number; percent: number };
  forms: { total: number; submitted: number; reviewed: number; complete: boolean };
  pipeline: { status: string; label: string; step: number; total_steps: number };
}

export interface HubRequirement {
  id: string;
  label: string;
  category: string;
  status: "missing" | "pending" | "approved" | "rejected" | "uploaded";
  checked: boolean;
  submission?: {
    id: number;
    file_url: string;
    status: string;
    original_filename?: string;
    mime_type?: string | null;
    rejection_comment?: string | null;
    uploaded_at?: string | null;
  } | null;
}

export interface HubIrccForm {
  code: string;
  name: string;
  type: string;
  status?: string;
  reviewed?: boolean;
}

export interface HubPackage {
  id: number;
  label: string;
  breadcrumb: string[];
  result?: { guide: string; checklist: string; forms: string[] } | null;
  documents: { id: number; label: string; file_url: string }[];
}

export function ProgressRing({ percent, size = 72 }: { percent: number; size?: number }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (percent / 100) * c;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={6} className="text-muted/30" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={6}
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          className="text-primary transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold">{percent}%</span>
      </div>
    </div>
  );
}

export function CaseHubProgressHeader({
  progress,
  pathway,
  packageLabel,
  pipelineLabel,
  govFormsPercent,
}: {
  progress: HubProgress;
  pathway: string | null;
  packageLabel?: string | null;
  pipelineLabel: string;
  govFormsPercent?: number | null;
}) {
  const pendingDocs = progress.documents.pending + progress.documents.missing;

  return (
    <div className="mb-5 rounded-2xl border bg-gradient-to-br from-slate-50 via-white to-primary/5 p-4 sm:p-5 dark:from-slate-900/40 dark:via-card dark:to-primary/10">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
        <div className="flex items-center gap-4 min-w-0">
          <ProgressRing percent={progress.overall_percent} size={80} />
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Case progress
            </p>
            <h2 className="mt-0.5 text-xl font-bold break-words">{pathway ?? "Immigration Case"}</h2>
            {packageLabel && (
              <p className="mt-1 text-xs text-muted-foreground truncate">{packageLabel}</p>
            )}
            <Badge variant="outline" className="mt-2 text-[11px]">{pipelineLabel}</Badge>
          </div>
        </div>

        <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
          <StatPill
            label="Documents"
            value={`${progress.documents.approved}/${progress.documents.total}`}
            sub={pendingDocs > 0 ? `${pendingDocs} pending` : "All reviewed"}
            tone={progress.documents.percent >= 80 ? "green" : "amber"}
          />
          <StatPill
            label="App forms"
            value={progress.forms.total === 0 ? "—" : `${progress.forms.reviewed}/${progress.forms.total}`}
            sub={progress.forms.total === 0 ? "None required" : progress.forms.complete ? "Complete" : "Needs review"}
            tone={progress.forms.complete ? "green" : progress.forms.total === 0 ? "neutral" : "blue"}
          />
          <StatPill
            label="Gov forms"
            value={govFormsPercent !== null && govFormsPercent !== undefined ? `${govFormsPercent}%` : "—"}
            sub={govFormsPercent === 100 ? "Ready to generate" : govFormsPercent !== null && govFormsPercent !== undefined ? "Auto-fill readiness" : "Loading…"}
            tone={govFormsPercent === 100 ? "green" : govFormsPercent !== null && govFormsPercent !== undefined ? "violet" : "neutral"}
          />
          <StatPill
            label="Pipeline"
            value={`${progress.pipeline.step}/${progress.pipeline.total_steps}`}
            sub={pipelineLabel}
            tone="neutral"
          />
        </div>
      </div>
    </div>
  );
}

function StatPill({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: "green" | "amber" | "blue" | "violet" | "neutral";
}) {
  const colors = {
    green: "bg-green-50/80 border-green-200/80 text-green-900 dark:bg-green-950/30",
    amber: "bg-amber-50/80 border-amber-200/80 text-amber-900 dark:bg-amber-950/30",
    blue: "bg-blue-50/80 border-blue-200/80 text-blue-900 dark:bg-blue-950/30",
    violet: "bg-violet-50/80 border-violet-200/80 text-violet-900 dark:bg-violet-950/30",
    neutral: "bg-muted/30 border-border text-foreground",
  };
  return (
    <div className={cn("rounded-xl border px-3 py-2.5", colors[tone])}>
      <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-xl font-bold leading-tight mt-0.5 tabular-nums">{value}</p>
      {sub && <p className="text-[10px] mt-1 opacity-75 line-clamp-1">{sub}</p>}
    </div>
  );
}

const REQ_STATUS: Record<string, { label: string; className: string }> = {
  approved: { label: "Approved", className: "bg-green-50 text-green-700 border-green-200" },
  pending:  { label: "Review", className: "bg-amber-50 text-amber-700 border-amber-200" },
  uploaded: { label: "Uploaded", className: "bg-blue-50 text-blue-700 border-blue-200" },
  rejected: { label: "Rejected", className: "bg-red-50 text-red-700 border-red-200" },
  missing:  { label: "Missing", className: "bg-muted text-muted-foreground border-border" },
};

export function DocumentRequirementsGrid({
  requirements,
  onReview,
  onViewDocument,
  buildSubmissionStreamUrl,
  consultantView = true,
  onToggleCheck,
  togglingCheckId,
  allDocuments,
  getAuthHeaders,
  renderStatusBadge,
}: {
  requirements: HubRequirement[];
  onReview?: (submissionId: number) => void;
  onViewDocument?: (title: string, streamUrl: string, mimeType?: string | null, filename?: string) => void;
  buildSubmissionStreamUrl?: (submissionId: number) => string;
  consultantView?: boolean;
  onToggleCheck?: (docId: string, checked: boolean) => void;
  togglingCheckId?: string | null;
  allDocuments?: ConsultantDocumentItem[];
  getAuthHeaders?: () => Record<string, string>;
  renderStatusBadge?: (status: string) => React.ReactNode;
}) {
  const grouped = requirements.reduce<Record<string, HubRequirement[]>>((acc, r) => {
    (acc[r.category] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category}>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 capitalize">
            {category.replace(/_/g, " ")}
          </p>
          <div className="space-y-2">
            {items.map((req) => {
              const st = REQ_STATUS[req.status] ?? REQ_STATUS.missing;
              const submission = req.submission;
              const streamUrl = submission && buildSubmissionStreamUrl
                ? buildSubmissionStreamUrl(submission.id)
                : null;
              const reqUploads = allDocuments?.filter((d) => d.document_type === req.id) ?? [];
              const showPreviewGrid = reqUploads.length > 0
                && buildSubmissionStreamUrl
                && getAuthHeaders
                && onViewDocument;

              return (
                <div
                  key={req.id}
                  className={cn(
                    "rounded-xl border bg-card p-4 space-y-3",
                    req.status === "approved" && "border-green-200/80 bg-green-50/20",
                    req.status === "rejected" && "border-red-200/80 bg-red-50/20",
                  )}
                >
                  <div className="flex items-start gap-3">
                    {req.status === "approved" ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                    ) : req.status === "missing" ? (
                      <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : req.status === "rejected" ? (
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                    ) : (
                      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{req.label}</p>
                        <Badge variant="outline" className={cn("text-[10px]", st.className)}>{st.label}</Badge>
                        {consultantView && req.checked && (
                          <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700">Checklist verified</Badge>
                        )}
                        {reqUploads.length > 1 && (
                          <Badge variant="outline" className="text-[10px]">
                            {reqUploads.length} files
                          </Badge>
                        )}
                      </div>

                      {!showPreviewGrid && submission ? (
                        <div className="mt-1.5 space-y-1">
                          <p className="truncate text-xs text-muted-foreground">
                            {submission.original_filename ?? submission.file_url.split("/").pop()}
                          </p>
                          {submission.uploaded_at && (
                            <p className="text-[11px] text-muted-foreground/80">
                              Uploaded {new Date(submission.uploaded_at).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </p>
                          )}
                          {submission.rejection_comment && (
                            <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-1.5 text-xs text-red-700">
                              <RotateCcw className="mr-1 inline h-3 w-3" />
                              Re-upload requested: {submission.rejection_comment}
                            </div>
                          )}
                        </div>
                      ) : !showPreviewGrid ? (
                        <p className="mt-1 text-xs text-muted-foreground">Waiting for client upload</p>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
                      {consultantView && onToggleCheck && (
                        <label className="flex cursor-pointer items-center gap-1.5 text-[10px] text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={req.checked}
                            disabled={togglingCheckId === req.id}
                            onChange={(e) => onToggleCheck(req.id, e.target.checked)}
                            className="rounded border-input"
                          />
                          Verified
                        </label>
                      )}

                      {!showPreviewGrid && submission && streamUrl && onViewDocument && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 text-xs"
                          onClick={() => onViewDocument(
                            req.label,
                            streamUrl,
                            submission.mime_type,
                            submission.original_filename,
                          )}
                        >
                          <Eye className="h-3 w-3" /> View
                        </Button>
                      )}

                      {consultantView && submission && onReview && (
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          variant={req.status === "rejected" ? "outline" : "default"}
                          onClick={() => onReview(submission.id)}
                        >
                          {req.status === "approved" ? "Update status" : req.status === "rejected" ? "Review again" : "Review"}
                        </Button>
                      )}
                    </div>
                  </div>

                  {showPreviewGrid && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {reqUploads.map((upload) => {
                        const uploadStreamUrl = buildSubmissionStreamUrl!(upload.id);
                        return (
                          <ConsultantDocumentPreviewCard
                            key={upload.id}
                            doc={{ ...upload, document_label: req.label }}
                            streamUrl={uploadStreamUrl}
                            getAuthHeaders={getAuthHeaders!}
                            statusBadge={renderStatusBadge?.(upload.status)}
                            onView={() => onViewDocument!(
                              req.label,
                              uploadStreamUrl,
                              upload.mime_type,
                              upload.original_filename,
                            )}
                            onManage={onReview ? () => onReview(upload.id) : undefined}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function IrccFormsList({ forms, pathway }: { forms: HubIrccForm[]; pathway: string | null }) {
  if (forms.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic py-4">
        No IRCC forms configured. Assign an application package in Pathway Calculator.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {forms.map((form, i) => (
        <div key={`${form.code}-${i}`} className="flex items-center gap-3 rounded-lg border px-4 py-3">
          {form.type === "interactive" ? (
            <FormInput className="h-4 w-4 text-purple-600 shrink-0" />
          ) : (
            <FileText className="h-4 w-4 text-primary shrink-0" />
          )}
          <span className="text-sm font-mono font-medium text-primary shrink-0">{form.code}</span>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-sm text-muted-foreground flex-1 min-w-0">{form.name}</span>
          {form.type === "interactive" && form.status && (
            <Badge variant="outline" className="text-[10px] shrink-0 capitalize">
              {form.reviewed ? "Reviewed" : form.status.replace(/_/g, " ")}
            </Badge>
          )}
          {form.type !== "interactive" && (
            <a href="https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides.html" target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline shrink-0">
              IRCC ↗
            </a>
          )}
        </div>
      ))}
      {pathway && (
        <p className="text-xs text-muted-foreground pt-1">
          Pathway: <strong>{pathway}</strong>
          {forms.some((f) => f.type === "interactive") && " — online forms are filled in Application Forms tab."}
        </p>
      )}
    </div>
  );
}

export function CaseHubOverview({
  progress,
  pathway,
  package: pkg,
  irccForms,
  requirements,
  nextActions,
  govFormsSummary,
  onViewPdf,
  buildPackageDocStreamUrl,
  onActionClick,
}: {
  progress: HubProgress;
  pathway: string | null;
  package: HubPackage | null;
  irccForms: HubIrccForm[];
  requirements: HubRequirement[];
  nextActions: { label: string; tab?: string; href?: string; urgent?: boolean }[];
  govFormsSummary?: {
    percent: number;
    formCount: number;
    reviewed: boolean;
    allReady: boolean;
    totalMissing: number;
  } | null;
  onViewPdf?: (title: string, streamUrl: string) => void;
  buildPackageDocStreamUrl?: (documentId: number) => string;
  onActionClick?: (tab: string) => void;
}) {
  const missing = requirements.filter((r) => r.status === "missing").length;
  const pendingReview = requirements.filter((r) => r.status === "pending" || r.status === "uploaded").length;

  const workflowCards = [
    {
      tab: "documents",
      title: "Documents",
      icon: FileText,
      value: `${progress.documents.approved}/${progress.documents.total}`,
      detail: missing > 0 ? `${missing} missing · ${pendingReview} to review` : pendingReview > 0 ? `${pendingReview} awaiting review` : "All documents approved",
      accent: pendingReview > 0 || missing > 0,
    },
    {
      tab: "forms",
      title: "Application Forms",
      icon: FormInput,
      value: progress.forms.total === 0 ? "PDF" : `${progress.forms.reviewed}/${progress.forms.total}`,
      detail: progress.forms.total === 0
        ? "This package uses PDF forms — see Government Forms"
        : progress.forms.complete
          ? "All forms reviewed"
          : "Review client submissions",
      accent: progress.forms.total > 0 && !progress.forms.complete,
    },
    {
      tab: "government-forms",
      title: "Government Forms",
      icon: FileCheck,
      value: govFormsSummary ? `${govFormsSummary.percent}%` : "—",
      detail: !govFormsSummary
        ? "Loading readiness…"
        : !govFormsSummary.reviewed
          ? "Review client data first"
          : govFormsSummary.allReady
            ? `${govFormsSummary.formCount} form(s) ready to generate`
            : `${govFormsSummary.totalMissing} data gap(s) to fill`,
      accent: true,
      highlight: true,
    },
    {
      tab: "messages",
      title: "Messages",
      icon: MessageSquare,
      value: "Chat",
      detail: "Client communication & updates",
      accent: false,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Next actions */}
      {nextActions.length > 0 && (
        <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50/80 to-orange-50/40 p-4 space-y-2 dark:from-amber-950/20 dark:to-orange-950/10">
          <p className="text-sm font-semibold flex items-center gap-2 text-amber-950 dark:text-amber-100">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" /> What to do next
          </p>
          <ul className="space-y-1">
            {nextActions.map((action, i) => (
              <li key={i}>
                {action.tab && onActionClick ? (
                  <button
                    type="button"
                    onClick={() => onActionClick(action.tab!)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-white/60 dark:hover:bg-white/5",
                      action.urgent && "font-medium",
                    )}
                  >
                    <ChevronRight className="h-4 w-4 text-primary shrink-0" />
                    <span>{action.label}</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2 text-sm px-3 py-2">
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>{action.label}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Workflow cards */}
      <div>
        <p className="text-sm font-semibold mb-3">Case workflow</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {workflowCards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.tab}
                type="button"
                onClick={() => onActionClick?.(card.tab)}
                className={cn(
                  "group rounded-2xl border p-4 text-left transition-all hover:shadow-md hover:border-primary/30",
                  card.highlight && "border-violet-200/80 bg-violet-50/30 dark:bg-violet-950/20",
                  card.accent && !card.highlight && "border-primary/20 bg-primary/5",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                      card.highlight ? "bg-violet-100 text-violet-700 dark:bg-violet-900/50" : "bg-muted text-muted-foreground",
                    )}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{card.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{card.detail}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-2xl font-bold tabular-nums leading-none">{card.value}</p>
                    <ChevronRight className="h-4 w-4 text-muted-foreground mt-2 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
                {card.tab === "government-forms" && govFormsSummary && (
                  <Progress value={govFormsSummary.percent} className="h-1.5 mt-3" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Package resources */}
      {pkg && (
        <div className="rounded-2xl border p-4 space-y-3 bg-card">
          <p className="text-sm font-semibold flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />
            Application Package — {pkg.label}
          </p>
          <p className="text-xs text-muted-foreground">{pkg.breadcrumb.join(" › ")}</p>
          {pkg.result && (
            <div className="flex flex-wrap gap-2 text-xs">
              {pkg.result.guide && <Badge variant="secondary">Guide: {pkg.result.guide}</Badge>}
              {pkg.result.checklist && <Badge variant="secondary">Checklist: {pkg.result.checklist}</Badge>}
            </div>
          )}
          {pkg.documents.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t">
              <p className="text-xs font-medium text-muted-foreground">IRCC reference PDFs</p>
              {pkg.documents.map((doc) => (
                onViewPdf && buildPackageDocStreamUrl ? (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => onViewPdf(doc.label, buildPackageDocStreamUrl(doc.id))}
                    className="flex items-center gap-2 text-sm text-primary hover:underline text-left"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> {doc.label}
                  </button>
                ) : (
                  <a key={doc.id} href={doc.file_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary hover:underline">
                    <ExternalLink className="h-3.5 w-3.5" /> {doc.label}
                  </a>
                )
              ))}
            </div>
          )}
        </div>
      )}

      {/* IRCC forms preview */}
      <div className="rounded-2xl border p-4 bg-card">
        <p className="text-sm font-semibold mb-3">Required IRCC Forms</p>
        <IrccFormsList forms={irccForms} pathway={pathway} />
      </div>
    </div>
  );
}

export function CaseHubLocked({
  title,
  message,
  backHref,
  backLabel = "Back to Workspace",
}: {
  title: string;
  message: string;
  backHref: string;
  backLabel?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-center max-w-md mx-auto">
      <FormInput className="h-12 w-12 text-muted-foreground/40" />
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button asChild>
        <Link href={backHref}>{backLabel}</Link>
      </Button>
    </div>
  );
}
